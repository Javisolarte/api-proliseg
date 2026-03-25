import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AsignarTurnosDto } from './dto/asignar_turnos.dto';
import { TurnosHelperService } from '../../common/helpers/turnos-helper.service';

interface Empleado {
  id: number;
  nombre_completo: string;
  [key: string]: any;
}

interface EmpleadoInfo {
  id: number; // ID de la asignacion
  empleado_id: number;
  rol_puesto: 'titular' | 'relevante';
  patron_descanso: string | null; // "4-2", "5-2"
  fecha_inicio_patron: string;
  fase_inicial: number | null; // Índice de la fase del ciclo donde empieza (0=primera fase)
  created_at: string;
  empleado: {
    id: number;
    nombre_completo: string;
    activo: boolean;
  };
}

interface DetalleTurno {
  id: number;
  plazas: number;
  hora_inicio: string | null;
  hora_fin: string | null;
  tipo: string;
  orden: number;
  dias_semana?: number[];
  aplica_festivos?: 'indiferente' | 'no_aplica' | 'solo_festivos';
  [key: string]: any;
}

@Injectable()
export class AsignarTurnosService {
  private readonly logger = new Logger(AsignarTurnosService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly turnosHelper: TurnosHelperService,
  ) { }

  /**
   * 📅 Helper: Obtener festivos de Colombia
   */
  private async obtenerFestivos(fechaInicio: Date, fechaFin: Date): Promise<string[]> {
    const supabase = this.supabaseService.getClient();
    const inicioStr = fechaInicio.toISOString().split('T')[0];
    const finStr = fechaFin.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('festivos_colombia')
      .select('fecha')
      .gte('fecha', inicioStr)
      .lte('fecha', finStr);

    if (error) {
      this.logger.warn('Error obteniendo festivos, se asume calendario sin festivos.');
      return [];
    }
    return (data || []).map((f: any) => f.fecha);
  }

  /**
   * 🧠 Helper: Lógica Biológica (4-2, 5-2, 6-1)
   * Decide si el titular debe trabajar hoy basado en matemáticas de fechas.
   */
  private titularDebeTrabajar(asignacion: EmpleadoInfo, fechaObjetivo: Date): boolean {
    // Si no tiene patrón asignado, trabaja siempre que la regla del puesto lo diga.
    if (!asignacion.patron_descanso || !asignacion.fecha_inicio_patron) return true;

    const partes = asignacion.patron_descanso.split('-').map(Number);
    if (partes.length < 2) return true;

    const diasTrabajo = partes[0];
    const diasDescanso = partes[1];
    const cicloTotal = diasTrabajo + diasDescanso;

    // Normalizar a media noche para evitar errores de horas
    const fechaInicio = new Date(asignacion.fecha_inicio_patron);
    fechaInicio.setHours(0, 0, 0, 0);
    const fechaObj = new Date(fechaObjetivo);
    fechaObj.setHours(0, 0, 0, 0);

    const diffTime = fechaObj.getTime() - fechaInicio.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      this.logger.debug(`📅 Empleado ${asignacion.empleado_id} aún no iniciaba su patrón en fecha ${fechaObj.toISOString()}`);
      return false; // Fecha anterior al inicio del patrón
    }

    // La magia matemática:
    const diaEnCiclo = diffDays % cicloTotal;

    // Si el residuo es menor a los días de trabajo, trabaja. Si no, descansa.
    return diaEnCiclo < diasTrabajo;
  }

  /**
   * 🧩 Generar turnos basados en SUBPUESTO
   * IMPORTANTE: Ahora usa subpuesto.configuracion_id y subpuesto.guardas_activos
   * @param dto Datos de generación
   * @param empleadosManual (Opcional) Lista explícita de empleados para usar (ignora DB)
   * @param fillFromMonthStart (Opcional, default true) Si true, inserta desde el día 1. Si false, inserta solo desde fecha_inicio.
   */
  async asignarTurnos(dto: AsignarTurnosDto, empleadosManual?: Empleado[], fillFromMonthStart: boolean = true) {
    const supabase = this.supabaseService.getClient();
    const { subpuesto_id, fecha_inicio, asignado_por } = dto;

    this.logger.log(`🔄 Iniciando generación de turnos para subpuesto ${subpuesto_id}`);

    // ✅ 1. Obtener subpuesto con su configuración
    const { data: subpuesto, error: subpuestoError } = await supabase
      .from('subpuestos_trabajo')
      .select(`
        *,
        puesto:puesto_id (
          id,
          nombre,
          contrato_id
        ),
        configuracion:configuracion_id (
          id,
          nombre,
          dias_ciclo,
          activo,
          tipo_proyeccion
        )
      `)
      .eq('id', subpuesto_id)
      .single();

    if (subpuestoError || !subpuesto) {
      this.logger.error(`❌ Subpuesto ${subpuesto_id} no encontrado`);
      throw new NotFoundException('Subpuesto no encontrado');
    }

    if (!subpuesto.configuracion_id) {
      throw new BadRequestException('El subpuesto no tiene configuración de turnos asignada');
    }

    if (!subpuesto.configuracion?.activo) {
      throw new BadRequestException('La configuración de turnos no está activa');
    }

    let empleados: Empleado[] = [];
    let empleadosRaw: EmpleadoInfo[] = [];

    if (empleadosManual && empleadosManual.length > 0) {
      // Usar empleados manuales si se proveen (ej: para rotación)
      empleados = empleadosManual;
      this.logger.log(`👥 Usando lista manual de ${empleados.length} empleados`);
    } else {
      // ✅ 2. Obtener empleados asignados al SUBPUESTO desde DB
      const { data: asignaciones, error: asignError } = await supabase
        .from('asignacion_guardas_puesto')
        .select(`
        id,
        empleado_id,
        rol_puesto,
        patron_descanso,
        fecha_inicio_patron,
        fase_inicial,
        created_at,
        empleado:empleado_id (
          id,
          nombre_completo,
          activo
        )
      `)
        .eq('subpuesto_id', subpuesto_id)
        .eq('activo', true);

      if (asignError) {
        this.logger.error(`❌ Error al obtener empleados: ${asignError.message}`);
        throw asignError;
      }

      empleadosRaw = (asignaciones || [])
        .filter((a: any) => a.empleado && a.empleado.activo)
        .map((a: any) => a as EmpleadoInfo);

      empleados = empleadosRaw.map(e => e.empleado as Empleado);
    }

    if (empleados.length === 0) {
      this.logger.warn(`⚠️ No hay empleados activos asignados al subpuesto ${subpuesto.nombre}. No se generaron turnos.`);
      return {
        message: 'No hay empleados activos asignados. Se eliminaron turnos futuros pero no se generaron nuevos.',
        total_turnos: 0,
        empleados: 0,
        detalle: []
      };
    }

    // ✅ 3. VALIDAR que la asignación esté COMPLETA antes de generar turnos
    const validacion = await this.turnosHelper.validarAsignacionCompleta(
      subpuesto_id,
      subpuesto.guardas_activos,
      subpuesto.configuracion_id
    );

    // Nota: Si usamos lista manual (rotación), asumimos que es válida o ignoramos la validación estricta de cantidad
    if (!empleadosManual && !validacion.valido) {
      this.logger.warn(
        `⚠️ ${validacion.mensaje}. No se pueden generar turnos hasta que todos los empleados estén asignados.`
      );
      throw new BadRequestException(
        `No se pueden generar turnos: ${validacion.mensaje}. ` +
        `Asigna ${validacion.faltantes} empleado(s) más antes de generar turnos.`
      );
    }

    this.logger.log(`✅ Validación completa: ${empleados.length} empleados asignados correctamente`);

    // ✅ 4. Obtener detalles de la configuración de turnos
    const { data: detalles, error: detallesError } = await supabase
      .from('turnos_detalle_configuracion')
      .select('*')
      .eq('configuracion_id', subpuesto.configuracion_id)
      .order('orden', { ascending: true });

    if (detallesError || !detalles || detalles.length === 0) {
      throw new BadRequestException('La configuración de turnos no tiene detalles definidos');
    }

    // ✅ 5. Generar turnos para el MES COMPLETO
    // Calcular el primer día del mes de la fecha de inicio para asegurar mes completo
    // fecha_inicio viene formato YYYY-MM-DD
    const [year, month, day] = fecha_inicio.split('-').map(Number);
    // Nota: month en Date es 0-indexed (0 = Enero, 11 = Diciembre)
    const fechaBase = new Date(year, month - 1, 1);

    // Calcular el último día del mes para saber cuántos días generar
    const ultimoDiaMes = new Date(year, month, 0);
    const numeroDeDiasAGenerar = ultimoDiaMes.getDate();

    // Fecha desde donde queremos INSERTAR realmente
    const fechaInicioInsert = new Date(fecha_inicio);
    // Asegurar que comparamos solo fechas sin hora
    fechaInicioInsert.setHours(0, 0, 0, 0);

    const festivos = await this.obtenerFestivos(fechaBase, ultimoDiaMes);
    const tipoProyeccion = subpuesto.configuracion?.tipo_proyeccion || 'ciclico';

    const turnosParaInsertar: any[] = [];

    // Detectar si es horario de oficina
    const isOficina = subpuesto.configuracion?.nombre?.toLowerCase().includes('oficina');

    const cicloLength = detalles.length;
    const guardasActivos = subpuesto.guardas_activos;

    this.logger.log(`📅 Generando turnos MENSUALES para ${empleados.length} empleados durante ${numeroDeDiasAGenerar} días (Mes: ${month}/${year})`);
    if (!fillFromMonthStart) {
      this.logger.log(`ℹ️ Modo Inserción Parcial: Solo se guardarán turnos desde ${fecha_inicio}`);
    }

    if (isOficina) {
      this.logger.log(`🏢 MODO OFICINA DETECTADO: Lunes a Viernes (8-12, 14-18) + Sábados (8-12)`);
    } else {
      this.logger.log(`🔄 Ciclo de ${cicloLength} días: ${detalles.map(d => d.tipo).join(' → ')}`);
    }
    this.logger.log(`👥 Guardas activos simultáneos: ${guardasActivos}`);
    this.logger.log(`⚙️ Estrategia: ${tipoProyeccion}`);

    if (tipoProyeccion === 'ciclico') {
      this.logger.log('🔄 Usando Estrategia Cíclica (Rotativa)');

      // 1. Separar equipo por roles
      const equipo = (empleadosRaw || []).sort((a, b) => a.id - b.id);
      const titulares = equipo.filter(e => !e.rol_puesto || e.rol_puesto === 'titular');
      const relevantes = equipo.filter(e => e.rol_puesto === 'relevante');

      // Calcular offset automático base si no hay manual (solo sobre titulares)
      const offsetPorEmpleado = titulares.length > 0 ? Math.floor(cicloLength / titulares.length) : 0;

      // Mapa para rastrear huecos por día: { "[fecha]_[plaza]": { horaInc, horaFin, tipo, orden } }
      const huecosPorDia = new Map<string, any>();

      // 2. Generar turnos para TITULARES
      titulares.forEach((empRaw, index) => {
        const empleado = empRaw.empleado;
        let offsetPersonalizado: number | null = null;

        // Limpieza y validación de fase_inicial
        const faseIni = (empRaw.fase_inicial !== null && empRaw.fase_inicial !== undefined)
          ? parseInt(empRaw.fase_inicial.toString(), 10)
          : 0;

        // Establecer ancla estable: prioridad fecha_inicio_patron, luego 1ro del mes de creación, o 2026-03-01 por defecto
        // Esto asegura que la secuencia sea continua aunque cambien los meses.
        const anchorDateStr = empRaw.fecha_inicio_patron || 
                             (empRaw.created_at ? empRaw.created_at.split('T')[0].substring(0, 8) + '01' : '2026-03-01');
        
        const [y, mon, day] = anchorDateStr.split('-').map(Number);
        const anchorDate = new Date(y, mon - 1, day);
        anchorDate.setHours(0, 0, 0, 0);
        
        const diffTime = fechaBase.getTime() - anchorDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        // El offset para el día 1 del mes es (fase inicial + días transcurridos) % cicloLength
        offsetPersonalizado = ((faseIni + diffDays) % cicloLength + cicloLength) % cicloLength;
        
        this.logger.log(`👤 TITULAR: ${empleado.nombre_completo} -> ANCLA: ${anchorDateStr} -> FASE: ${faseIni} -> OFFSET MES: ${offsetPersonalizado}`);

        const offsetInicial = offsetPersonalizado;

        for (let dia = 0; dia < numeroDeDiasAGenerar; dia++) {
          const fechaTurno = new Date(fechaBase);
          fechaTurno.setDate(fechaTurno.getDate() + dia);
          const fechaStr = fechaTurno.toISOString().split('T')[0];

          // Detección de salto de día para inserción parcial
          let skipInsert = false;
          if (!fillFromMonthStart) {
            const check = new Date(fechaTurno); check.setHours(0, 0, 0, 0);
            if (check < fechaInicioInsert) skipInsert = true;
          }

          const diaSemana = fechaTurno.getDay();
          const diaDelCiclo = (dia + offsetInicial) % cicloLength;
          const detalle = detalles[diaDelCiclo];
          const tipoTurno = detalle.tipo?.toUpperCase() || 'NORMAL';
          const esDescanso = tipoTurno === 'DESCANSO' || tipoTurno === 'Z';
          const plazaNo = (index % guardasActivos) + 1;

          if (isOficina) {
            // LÓGICA OFICINA (No usa Relevantes Cíclicos usualmente, pero se mantiene coherencia)
            if (diaSemana === 0) continue;

            const turnosOficina: { hora_inicio: string; hora_fin: string; }[] = [];
            if (diaSemana === 6) {
              turnosOficina.push({ hora_inicio: '08:00:00', hora_fin: '12:00:00' });
            } else {
              turnosOficina.push({ hora_inicio: '08:00:00', hora_fin: '12:00:00' });
              turnosOficina.push({ hora_inicio: '14:00:00', hora_fin: '18:00:00' });
            }

            if (!skipInsert) {
              turnosOficina.forEach(t => {
                turnosParaInsertar.push({
                  empleado_id: empleado.id,
                  puesto_id: subpuesto.puesto_id,
                  subpuesto_id: subpuesto_id,
                  fecha: fechaStr,
                  hora_inicio: t.hora_inicio,
                  hora_fin: t.hora_fin,
                  tipo_turno: 'NORMAL',
                  configuracion_id: subpuesto.configuracion_id,
                  orden_en_ciclo: diaSemana,
                  plaza_no: 1,
                  grupo: 'OFICINA',
                  asignado_por,
                  estado_turno: 'programado',
                });
              });
            }
          } else {
            // LÓGICA CÍCLICA REGULAR
            if (esDescanso) {
              const key = `${fechaStr}_${plazaNo}`;
              if (!huecosPorDia.has(key)) {
                // Buscamos un horario válido para este hueco. 
                // Si el detalle tiene 00:00:00, intentamos buscar el horario de la misma plaza 
                // en otros días del ciclo si fuera posible, o simplemente tomamos el del detalle 
                // si el admin configuró el horario deseado en el día de "Z".
                huecosPorDia.set(key, {
                  fecha: fechaStr,
                  plaza: plazaNo,
                  hora_inicio: detalle.hora_inicio,
                  hora_fin: detalle.hora_fin,
                  orden: detalle.orden
                });
              }
            }

            if (!skipInsert) {
              turnosParaInsertar.push({
                empleado_id: empleado.id,
                puesto_id: subpuesto.puesto_id,
                subpuesto_id: subpuesto_id,
                fecha: fechaStr,
                hora_inicio: esDescanso ? null : detalle.hora_inicio,
                hora_fin: esDescanso ? null : detalle.hora_fin,
                tipo_turno: tipoTurno,
                configuracion_id: subpuesto.configuracion_id,
                orden_en_ciclo: detalle.orden,
                plaza_no: plazaNo,
                grupo: `GRUPO_${Math.floor(index / guardasActivos) + 1}`,
                asignado_por,
                estado_turno: 'programado',
              });
            }
          }
        }
      });

      // 3. Generar turnos para RELEVANTES (Llenar huecos)
      if (relevantes.length > 0 && huecosPorDia.size > 0 && !isOficina) {
        this.logger.log(`🔍 Llenando ${huecosPorDia.size} huecos con ${relevantes.length} relevantes`);

        const huecosOrdenados = Array.from(huecosPorDia.values()).sort((a, b) => {
          if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
          return a.plaza - b.plaza;
        });

        huecosOrdenados.forEach((hueco, hIndex) => {
          const relevante = relevantes[hIndex % relevantes.length];
          const fechaHueco = new Date(hueco.fecha + 'T00:00:00');
          if (!fillFromMonthStart && fechaHueco < fechaInicioInsert) return;

          // DETERMINAR HORARIO: Si la config tiene 00:00:00 en el descanso Z de la DB, 
          // usaremos una heurística o simplemente lo que diga el detalle.
          // Para el 3-3-2 de 7-7, el relevo debería trabajar 07-19 o 19-07 según la plaza.

          turnosParaInsertar.push({
            empleado_id: relevante.empleado_id,
            puesto_id: subpuesto.puesto_id,
            subpuesto_id: subpuesto_id,
            fecha: hueco.fecha,
            hora_inicio: hueco.hora_inicio,
            hora_fin: hueco.hora_fin,
            tipo_turno: 'RELEVO',
            configuracion_id: subpuesto.configuracion_id,
            orden_en_ciclo: hueco.orden,
            plaza_no: hueco.plaza,
            grupo: 'RELEVO',
            asignado_por,
            estado_turno: 'programado',
            observaciones: `Cubre descanso de Titular en Plaza ${hueco.plaza}`
          });
        });
      }
    } else {
      // ===========================================================================
      // 🟢 ESTRATEGIA NUEVA (REGLAS SEMANALES + INTELIGENCIA BIOLÓGICA)
      // ===========================================================================
      this.logger.log('🧠 Usando Estrategia Inteligente (Reglas + Turneros)');

      const equipo = (empleadosRaw || []).sort((a, b) => a.id - b.id);
      const titulares = equipo.filter(e => !e.rol_puesto || e.rol_puesto === 'titular');
      const relevantes = equipo.filter(e => e.rol_puesto === 'relevante');

      for (let dia = 0; dia < numeroDeDiasAGenerar; dia++) {
        const fechaActual = new Date(fechaBase);
        fechaActual.setDate(fechaActual.getDate() + dia);

        if (!fillFromMonthStart) {
          const check = new Date(fechaActual); check.setHours(0, 0, 0, 0);
          if (check < fechaInicioInsert) continue;
        }

        const fechaStr = fechaActual.toISOString().split('T')[0];
        const diaSemana = fechaActual.getDay(); // 0=Dom
        const esFestivo = festivos.includes(fechaStr);

        // PASO A: ¿Qué reglas aplican hoy?
        const reglasDeHoy = detalles.filter(regla => {
          if (regla.aplica_festivos === 'no_aplica' && esFestivo) return false;
          if (regla.aplica_festivos === 'solo_festivos' && !esFestivo) return false;
          if (regla.dias_semana && Array.isArray(regla.dias_semana)) {
            if (!regla.dias_semana.includes(diaSemana)) return false;
          }
          return true;
        });

        // PASO B: Llenar plazas
        reglasDeHoy.forEach((regla) => {
          for (let plaza = 0; plaza < guardasActivos; plaza++) {
            let candidato: EmpleadoInfo | null = null;
            let grupo = 'TITULAR';
            let observaciones: string | null = null;
            let asignado = false;

            const titular = titulares.length > 0 ? titulares[plaza % titulares.length] : null;

            if (titular) {
              if (this.titularDebeTrabajar(titular, fechaActual)) {
                candidato = titular;
                grupo = 'TITULAR';
                asignado = true;
              } else if (relevantes.length > 0) {
                const indexTurnero = (dia + plaza) % relevantes.length;
                candidato = relevantes[indexTurnero];
                grupo = 'RELEVO';
                observaciones = `Cubre descanso de ${titular.empleado.nombre_completo}`;
                asignado = true;
              }
            } else if (relevantes.length > 0) {
              candidato = relevantes[(dia + plaza) % relevantes.length];
              grupo = 'RELEVO_PURO';
              asignado = true;
            }

            if (asignado && candidato) {
              turnosParaInsertar.push({
                empleado_id: candidato.empleado_id,
                puesto_id: subpuesto.puesto_id,
                subpuesto_id: subpuesto_id,
                fecha: fechaStr,
                hora_inicio: regla.hora_inicio,
                hora_fin: regla.hora_fin,
                tipo_turno: regla.tipo,
                configuracion_id: subpuesto.configuracion_id,
                orden_en_ciclo: diaSemana,
                plaza_no: plaza + 1,
                grupo: grupo,
                asignado_por,
                estado_turno: 'programado',
                observaciones: observaciones
              });
            }
          }
        });
      }
    }

    // ✅ 6. Insertar turnos en la base de datos
    if (turnosParaInsertar.length > 0) {
      const { error: insertError } = await supabase
        .from('turnos')
        .insert(turnosParaInsertar);

      if (insertError) {
        this.logger.error(`❌ Error insertando turnos: ${insertError.message}`);
        throw insertError;
      }
    }

    // ✅ 7. Registrar en log de generación
    try {
      await supabase.from('turnos_generacion_log').insert({
        puesto_id: subpuesto.puesto_id,
        subpuesto_id: subpuesto_id,
        configuracion_id: subpuesto.configuracion_id,
        mes: fechaBase.getMonth() + 1,
        año: fechaBase.getFullYear(),
        generado_por: asignado_por,
        descripcion: `Generados ${turnosParaInsertar.length} turnos para ${empleados.length} empleados con ${guardasActivos} activos (incluye descansos)`,
      });
    } catch (logError) {
      this.logger.warn('⚠️ No se pudo registrar el log de generación, pero los turnos se insertaron.');
    }

    this.logger.log(`✅ ${turnosParaInsertar.length} turnos generados exitosamente`);
    this.logger.log(`📊 Distribución: ${empleados.length} empleados en ${Math.ceil(empleados.length / guardasActivos)} grupos`);

    return {
      message: 'Turnos generados exitosamente',
      total_turnos: turnosParaInsertar.length,
      empleados: empleados.length,
      dias: numeroDeDiasAGenerar,
      guardas_activos: guardasActivos,
      grupos: Math.ceil(empleados.length / guardasActivos),
      subpuesto: subpuesto.nombre,
      configuracion: subpuesto.configuracion?.nombre
    };
  }

  /**
   * 🧠 Generación automática mensual
   * Genera turnos para todos los subpuestos que tengan configuración
   * @param mes Opcional: Mes específico a generar
   * @param año Opcional: Año específico a generar
   */
  async generarTurnosAutomaticos(mes?: number, año?: number, asignadoPor: number = 203) {
    const supabase = this.supabaseService.getClient();
    this.logger.log('🤖 Iniciando generación automática de turnos...');

    const fechaActual = new Date();
    const periodos: { mes: number, año: number }[] = [];

    if (mes && año) {
      // Si se especifica un periodo, usar ese
      periodos.push({ mes, año });
    } else {
      // Por defecto, siempre intentar generar el mes actual (por si faltan)
      periodos.push({
        mes: fechaActual.getMonth() + 1,
        año: fechaActual.getFullYear()
      });

      // Si es 25 o más, intentar generar también el mes siguiente
      if (fechaActual.getDate() >= 25) {
        const fechaProximoMes = new Date(fechaActual.getFullYear(), fechaActual.getMonth() + 1, 1);
        periodos.push({
          mes: fechaProximoMes.getMonth() + 1,
          año: fechaProximoMes.getFullYear()
        });
        this.logger.log('📅 Fin de mes detectado (>= 25). Se incluirá generación para el próximo mes.');
      }
    }

    // Obtener todos los subpuestos activos con configuración
    const { data: subpuestos, error } = await supabase
      .from('subpuestos_trabajo')
      .select(`
        id,
        nombre,
        puesto_id,
        configuracion_id,
        configuracion:configuracion_id (
          id,
          nombre,
          activo
        )
      `)
      .eq('activo', true)
      .not('configuracion_id', 'is', null);

    if (error || !subpuestos) {
      this.logger.error('❌ Error al obtener subpuestos para generación automática');
      return;
    }

    let generadosTotal = 0;
    let omitidosTotal = 0;

    for (const periodo of periodos) {
      const { mes: m, año: a } = periodo;
      this.logger.log(`📅 Procesando periodo ${m}/${a}...`);

      for (const subpuesto of subpuestos) {
        // 🔍 VERIFICACIÓN ROBUSTA: No solo ver el log, sino también si hay turnos reales
        const { data: yaGenerado } = await supabase
          .from('turnos_generacion_log')
          .select('id')
          .eq('subpuesto_id', subpuesto.id)
          .eq('mes', m)
          .eq('año', a)
          .maybeSingle();

        // Calcular fechas del periodo para verificar en la tabla de turnos
        const fechaInicioPeriodo = `${a}-${String(m).padStart(2, '0')}-01`;
        // El fin de mes no es estrictamente necesario si filtramos por subpuesto y mes/año en la query si existiera esa col, 
        // pero como 'turnos' usa 'fecha', buscaremos si hay al menos un turno en ese mes.
        const fechaFinPeriodo = `${a}-${String(m).padStart(2, '0')}-28`; // Suficiente para detectar presencia

        const { count: turnosExistentes } = await supabase
          .from('turnos')
          .select('id', { count: 'exact', head: true })
          .eq('subpuesto_id', subpuesto.id)
          .gte('fecha', fechaInicioPeriodo)
          .lte('fecha', `${a}-${String(m).padStart(2, '0')}-31`);

        if (yaGenerado && (turnosExistentes && turnosExistentes > 10)) {
          omitidosTotal++;
          continue;
        }

        if (yaGenerado && (!turnosExistentes || turnosExistentes === 0)) {
          this.logger.warn(`⚠️ Log existe para subpuesto ${subpuesto.nombre} (${m}/${a}) pero NO se encontraron turnos. Reintentando generación...`);
        }

        try {
          // 🕒 CORRECCIÓN: Formatear fecha sin desfase de zona horaria
          const fechaInicio = `${a}-${String(m).padStart(2, '0')}-01`;

          const dto = {
            subpuesto_id: subpuesto.id,
            fecha_inicio: fechaInicio,
            asignado_por: asignadoPor, // 🔥 Usar el ID proporcionado (o 203 por defecto)
          };

          this.logger.log(`⏳ Iniciando asignación para ${subpuesto.nombre} con fecha inicio: ${fechaInicio}`);
          await this.asignarTurnos(dto as any);
          generadosTotal++;
          this.logger.log(`✅ Turnos generados para subpuesto ${subpuesto.nombre} (${m}/${a})`);
        } catch (error: any) {
          this.logger.error(`❌ Error generando turnos para subpuesto ${subpuesto.nombre} (${m}/${a}): ${error.message}`);
        }
      }
    }

    this.logger.log(`🎯 Generación automática completada: ${generadosTotal} generados, ${omitidosTotal} omitidos`);
    return { generados: generadosTotal, omitidos: omitidosTotal, periodos_procesados: periodos.length };
  }

  /**
   * 📋 Listar turnos por subpuesto
   */
  async listarTurnos(subpuesto_id: number, desde?: string, hasta?: string) {
    const supabase = this.supabaseService.getClient();

    let query = supabase
      .from('turnos')
      .select(`
        *,
        empleado:empleado_id (
          id,
          nombre_completo,
          cedula
        ),
        subpuesto:subpuesto_id (
          id,
          nombre
        )
      `)
      .eq('subpuesto_id', subpuesto_id)
      .order('fecha', { ascending: true })
      .order('hora_inicio', { ascending: true });

    if (desde) query = query.gte('fecha', desde);
    if (hasta) query = query.lte('fecha', hasta);

    const { data, error } = await query;

    if (error) {
      this.logger.error(`❌ Error listando turnos: ${error.message}`);
      throw error;
    }

    return data || [];
  }

  /**
   * 🗑️ Eliminar turnos programados de un subpuesto
   */
  async eliminarTurnos(subpuesto_id: number, desde: string, hasta: string) {
    const supabase = this.supabaseService.getClient();

    // 0. LIMPIEZA DE DEPENDENCIAS: Desvincular de rutas de supervisión para evitar error FK
    try {
      const { data: turnosAEliminar } = await supabase
        .from('turnos')
        .select('id')
        .eq('subpuesto_id', subpuesto_id)
        .gte('fecha', desde)
        .lte('fecha', hasta);

      if (turnosAEliminar && turnosAEliminar.length > 0) {
        const ids = turnosAEliminar.map(t => t.id);
        await supabase
          .from('rutas_supervision_asignacion')
          .update({ turno_id: null })
          .in('turno_id', ids);

        this.logger.log(`🔗 Desvinculados ${ids.length} turnos de rutas de supervisión`);
      }
    } catch (err) {
      this.logger.warn(`⚠️ Error al desvincular rutas de supervisión: ${err.message}`);
    }

    const { data, error } = await supabase
      .from('turnos')
      .delete()
      .eq('subpuesto_id', subpuesto_id)
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .neq('tipo_turno', 'RET') // ✅ NUNCA eliminar turnos de empleados retirados
      // .eq('estado_turno', 'programado') // Comentado para asegurar limpieza completa en rangos dados
      .select();

    if (error) {
      this.logger.error(`❌ Error eliminando turnos: ${error.message}`);
      throw error;
    }

    const eliminados = data?.length || 0;
    this.logger.log(`✅ ${eliminados} turnos eliminados del subpuesto ${subpuesto_id}`);

    return {
      message: `Se eliminaron ${eliminados} turnos`,
      eliminados
    };
  }

  /**
   * 🔄 Rotar turnos entre empleados (REESCRITO - REGENERACIÓN SANA)
   * 1. Obtiene empleados activos.
   * 2. Rota el orden de los empleados.
   * 3. Elimina turnos "programados" en el rango.
   * 4. Regenera turnos usando el nuevo orden pero respetando el ciclo del mes.
   */
  async rotarTurnos(subpuesto_id: number, asignado_por: number, desde?: string, hasta?: string) {
    const supabase = this.supabaseService.getClient();
    this.logger.log(`🔄 Iniciando rotación de turnos INTELIGENTE para subpuesto ${subpuesto_id}`);

    const fechaInicio = desde || new Date().toISOString().split('T')[0];
    // Si no hay fecha fin, usar fin de mes de la fecha inicio? O un valor seguro lejano?
    // Usaremos un valor lejano por defecto para limpiar todo el futuro si no se especifica 'hasta'
    const fechaFin = hasta || '2099-12-31';

    // 1. Obtener empleados activos ACTUALMENTE
    const { data: asignaciones, error: asignError } = await supabase
      .from('asignacion_guardas_puesto')
      .select(`
        empleado_id,
        empleado:empleado_id (
          id,
          nombre_completo,
          activo
        )
      `)
      .eq('subpuesto_id', subpuesto_id)
      .eq('activo', true);

    if (asignError) throw new BadRequestException('Error al obtener empleados para rotar');

    // Obtener y ordenar por ID para tener el orden base determinista
    const empleadosBase: Empleado[] = (asignaciones || [])
      .filter((a: any) => a.empleado && a.empleado.activo)
      .map((a: any) => a.empleado as Empleado)
      .sort((a, b) => a.id - b.id);

    if (empleadosBase.length < 2) {
      throw new BadRequestException('Se necesitan al menos 2 empleados para rotar turnos');
    }

    // 2. Rotar el array: El primero pasa al final, todos suben uno.
    // [A, B, C] -> [B, C, A]
    // A toma el horario de C? No.
    // En la lógica de generación: Index 0 tiene offset 0.
    // Si pasamos [B, C, A]:
    // B (idx 0) tendrá offset 0 (El horario que antes tenía A).
    // C (idx 1) tendrá offset 1 (El horario que antes tenía B).
    // A (idx 2) tendrá offset 2 (El horario que antes tenía C).
    // Resultado: B toma horario de A. C toma horario de B. A toma horario de C.
    // Esto es una rotación "hacia atrás" en asignación? O "hacia adelante"?
    // Si A quiere tomar el turno de B...
    // Si el usuario quiere "Rotar", generalmente quiere que cambien de puesto ciclicamente.
    // Esta rotación básica es suficiente.

    const primerEmpleado = empleadosBase.shift();
    if (primerEmpleado) empleadosBase.push(primerEmpleado);
    const empleadosRotados = empleadosBase;

    this.logger.log(`🔀 Orden de empleados rotado. Nuevo líder: ${empleadosRotados[0].nombre_completo}`);

    // 3. Eliminar turnos existentes en el rango
    const { eliminados } = await this.eliminarTurnos(subpuesto_id, fechaInicio, fechaFin);
    this.logger.log(`🧹 Eliminados ${eliminados} turnos antiguos para preparar regeneración rotada`);

    // 4. Regenerar con la nueva lista manual
    // IMPORTANTE: Usamos fillFromMonthStart = false para NO sobrescribir el pasado (días < fechaInicio)
    // Pero la lógica interna calculará el ciclo desde el día 1, garantizando continuidad de patrón (evita "Z Z Z")

    const resultado = await this.asignarTurnos({
      subpuesto_id,
      fecha_inicio: fechaInicio,
      asignado_por: asignado_por // Usar ID pasado por parámetro
    }, empleadosRotados, false); // false = Partial Insert

    return {
      message: '✅ Turnos rotados y regenerados exitosamente',
      turnos_regenerados: resultado.total_turnos,
      eliminados_anteriores: eliminados,
      nuevo_orden_ciclo: empleadosRotados.map(e => e.nombre_completo)
    };
  }

  /**
   * 🔄 Regenerar turnos para un subpuesto
   * Elimina turnos futuros y los vuelve a generar con la configuración actual
   */
  async regenerarTurnos(subpuesto_id: number, userId: number, fechaInicio?: string) {
    this.logger.log(`♻️ Regenerando turnos para subpuesto ${subpuesto_id}`);

    let fechaReferencia: string;
    if (fechaInicio) {
      fechaReferencia = fechaInicio;
    } else {
      const fechaManana = new Date();
      fechaManana.setDate(fechaManana.getDate() + 1);
      fechaReferencia = fechaManana.toISOString().split('T')[0];
    }

    // 1. Eliminar turnos futuros (desde la fecha de referencia en adelante)
    const { message, eliminados } = await this.eliminarTurnos(
      subpuesto_id,
      fechaReferencia,
      '2099-12-31' // Fecha lejana
    );

    this.logger.log(`🗑️ Se eliminaron ${eliminados} turnos futuros (desde ${fechaReferencia})`);

    // 2. Generar nuevos turnos
    try {
      const resultadoGeneracion = await this.asignarTurnos({
        subpuesto_id,
        fecha_inicio: fechaReferencia,
        asignado_por: userId
      }, undefined, false); // ✅ fillFromMonthStart: false para respetar fecha_inicio

      return {
        message: 'Turnos regenerados exitosamente',
        eliminados,
        generados: resultadoGeneracion.total_turnos,
        detalle: resultadoGeneracion
      };

    } catch (error: any) {
      this.logger.error(`❌ Error al regenerar turnos: ${error.message}`);
      throw new BadRequestException(`Error al regenerar: ${error.message}`);
    }
  }

  /**
   * 🚨 ELIMINA TODOS LOS TURNOS DE UN SUBPUESTO
   * Borrado definitivo sin importar fecha ni estado
   */
  async eliminarTodosTurnos(subpuesto_id: number) {
    const supabase = this.supabaseService.getClient();
    this.logger.warn(`🚨 ELIMINANDO TODOS LOS TURNOS DEL SUBPUESTO ${subpuesto_id}`);

    // 0. LIMPIEZA DE DEPENDENCIAS
    try {
      const { data: turnosAEliminar } = await supabase
        .from('turnos')
        .select('id')
        .eq('subpuesto_id', subpuesto_id);

      if (turnosAEliminar && turnosAEliminar.length > 0) {
        const ids = turnosAEliminar.map(t => t.id);
        await supabase
          .from('rutas_supervision_asignacion')
          .update({ turno_id: null })
          .in('turno_id', ids);
      }
    } catch (err) {
      this.logger.warn(`⚠️ Error al desvincular rutas de supervisión: ${err.message}`);
    }

    const { data, error } = await supabase
      .from('turnos')
      .delete()
      .eq('subpuesto_id', subpuesto_id)
      .select();

    if (error) {
      this.logger.error(`❌ Error eliminando todos los turnos: ${error.message}`);
      throw new BadRequestException(`Error eliminando turnos: ${error.message}`);
    }

    const eliminados = data?.length || 0;
    return {
      message: `Se eliminaron DEFINITIVAMENTE ${eliminados} turnos.`,
      eliminados
    };
  }

  /**
   * ⏭️ Genera los turnos del PRÓXIMO MES
   * Lo hace con base en la fecha actual (si hoy es Enero, genera Febrero)
   */
  async generarTurnosProximoMes(subpuesto_id: number, asignado_por: number) {
    // Calcular el 1 del mes siguiente
    const hoy = new Date();
    const proximoMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
    const fechaInicioStr = proximoMes.toISOString().split('T')[0];

    this.logger.log(`⏭️ Generando turnos para el próximo mes (Inicio: ${fechaInicioStr})`);

    return this.asignarTurnos({
      subpuesto_id: subpuesto_id,
      fecha_inicio: fechaInicioStr,
      asignado_por: asignado_por
    });
  }
}
