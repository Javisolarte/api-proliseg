import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AsignarTurnosDto } from './dto/asignar_turnos.dto';
import { TurnosHelperService } from '../../common/helpers/turnos-helper.service';

interface Empleado {
  id: number;
  nombre_completo: string;
  [key: string]: any;
}

interface DetalleTurno {
  id: number;
  plazas: number;
  hora_inicio: string | null;
  hora_fin: string | null;
  tipo: string;
  orden: number;
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
          activo
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

      empleados = (asignaciones || [])
        .filter((a: any) => a.empleado && a.empleado.activo)
        .map((a: any) => a.empleado as Empleado);
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

    const offsetPorEmpleado = Math.floor(cicloLength / empleados.length);

    empleados.forEach((empleado: Empleado, empleadoIndex) => {
      const offsetInicial = (empleadoIndex * offsetPorEmpleado) % cicloLength;

      for (let dia = 0; dia < numeroDeDiasAGenerar; dia++) {
        // Calcular fecha del turno (Siempre desde el día 1 para mantener el ciclo consistente)
        const fechaTurno = new Date(fechaBase);
        fechaTurno.setDate(fechaTurno.getDate() + dia);

        // Si no estamos rellenando desde el inicio, saltar días anteriores a la fecha solicitada
        if (!fillFromMonthStart) {
          const fechaTurnoCheck = new Date(fechaTurno);
          fechaTurnoCheck.setHours(0, 0, 0, 0);
          if (fechaTurnoCheck < fechaInicioInsert) {
            continue;
          }
        }

        const diaSemana = fechaTurno.getDay(); // 0 = Domingo, 1 = Lunes...

        if (isOficina) {
          // --- LÓGICA HORARIO DE OFICINA ---
          // Domingo (0) -> Descanso (no se genera turno)
          if (diaSemana === 0) continue;

          // Sabado (6) -> 8:00 - 12:00
          if (diaSemana === 6) {
            turnosParaInsertar.push({
              empleado_id: empleado.id,
              puesto_id: subpuesto.puesto_id,
              subpuesto_id: subpuesto_id,
              fecha: fechaTurno.toISOString().split('T')[0],
              hora_inicio: '08:00:00',
              hora_fin: '12:00:00',
              tipo_turno: 'NORMAL',
              configuracion_id: subpuesto.configuracion_id,
              orden_en_ciclo: diaSemana,
              plaza_no: 1,
              grupo: 'OFICINA',
              asignado_por,
              estado_turno: 'programado',
            });
            continue;
          }

          // Lunes (1) a Viernes (5) -> 8-12 y 14-18
          // Turno AM
          turnosParaInsertar.push({
            empleado_id: empleado.id,
            puesto_id: subpuesto.puesto_id,
            subpuesto_id: subpuesto_id,
            fecha: fechaTurno.toISOString().split('T')[0],
            hora_inicio: '08:00:00',
            hora_fin: '12:00:00',
            tipo_turno: 'NORMAL',
            configuracion_id: subpuesto.configuracion_id,
            orden_en_ciclo: diaSemana,
            plaza_no: 1,
            grupo: 'OFICINA',
            asignado_por,
            estado_turno: 'programado',
          });

          // Turno PM
          turnosParaInsertar.push({
            empleado_id: empleado.id,
            puesto_id: subpuesto.puesto_id,
            subpuesto_id: subpuesto_id,
            fecha: fechaTurno.toISOString().split('T')[0],
            hora_inicio: '14:00:00',
            hora_fin: '18:00:00',
            tipo_turno: 'NORMAL',
            configuracion_id: subpuesto.configuracion_id,
            orden_en_ciclo: diaSemana,
            plaza_no: 1,
            grupo: 'OFICINA',
            asignado_por,
            estado_turno: 'programado',
          });

        } else {
          // --- LÓGICA CICLO REGULAR ---
          const diaDelCiclo = (dia + offsetInicial) % cicloLength;
          const detalle = detalles[diaDelCiclo];

          const tipoTurno = detalle.tipo?.toUpperCase() || 'NORMAL';
          const esDescanso = tipoTurno === 'DESCANSO' || tipoTurno === 'Z';

          const turno = {
            empleado_id: empleado.id,
            puesto_id: subpuesto.puesto_id,
            subpuesto_id: subpuesto_id,
            fecha: fechaTurno.toISOString().split('T')[0],
            hora_inicio: esDescanso ? null : detalle.hora_inicio,
            hora_fin: esDescanso ? null : detalle.hora_fin,
            tipo_turno: tipoTurno,
            configuracion_id: subpuesto.configuracion_id,
            orden_en_ciclo: detalle.orden,
            plaza_no: empleadoIndex + 1,
            grupo: `GRUPO_${Math.floor(empleadoIndex / guardasActivos) + 1}`,
            asignado_por,
            estado_turno: 'programado',
          };

          turnosParaInsertar.push(turno);
        }
      }
    });

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
    await supabase.from('turnos_generacion_log').insert({
      puesto_id: subpuesto.puesto_id,
      subpuesto_id: subpuesto_id,
      configuracion_id: subpuesto.configuracion_id,
      mes: fechaBase.getMonth() + 1,
      año: fechaBase.getFullYear(),
      generado_por: asignado_por,
      descripcion: `Generados ${turnosParaInsertar.length} turnos para ${empleados.length} empleados con ${guardasActivos} activos (incluye descansos)`,
    });

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
   */
  async generarTurnosAutomaticos() {
    const supabase = this.supabaseService.getClient();
    this.logger.log('🤖 Iniciando generación automática de turnos...');

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

    const fechaActual = new Date();
    const mesActual = fechaActual.getMonth() + 1;
    const añoActual = fechaActual.getFullYear();
    let generados = 0;
    let omitidos = 0;

    for (const subpuesto of subpuestos) {
      // Verificar si ya se generaron turnos este mes
      const { data: yaGenerado } = await supabase
        .from('turnos_generacion_log')
        .select('id')
        .eq('subpuesto_id', subpuesto.id)
        .eq('mes', mesActual)
        .eq('año', añoActual)
        .maybeSingle();

      if (yaGenerado) {
        this.logger.debug(`⏭️ Subpuesto ${subpuesto.nombre} ya tiene turnos generados para ${mesActual}/${añoActual}`);
        omitidos++;
        continue;
      }

      try {
        const dto = {
          subpuesto_id: subpuesto.id,
          fecha_inicio: new Date(añoActual, mesActual - 1, 1).toISOString().split('T')[0],
          asignado_por: 1, // Sistema automático
        };

        await this.asignarTurnos(dto as any);
        generados++;
        this.logger.log(`✅ Turnos generados para subpuesto ${subpuesto.nombre} (${mesActual}/${añoActual})`);
      } catch (error: any) {
        this.logger.error(`❌ Error generando turnos para subpuesto ${subpuesto.nombre}: ${error.message}`);
      }
    }

    this.logger.log(`🎯 Generación automática completada: ${generados} generados, ${omitidos} omitidos`);
    return { generados, omitidos };
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

    const { data, error } = await supabase
      .from('turnos')
      .delete()
      .eq('subpuesto_id', subpuesto_id)
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .eq('estado_turno', 'programado')
      .select();

    if (error) {
      this.logger.error(`❌ Error eliminando turnos: ${error.message}`);
      throw error;
    }

    const eliminados = data?.length || 0;
    this.logger.log(`✅ ${eliminados} turnos eliminados del subpuesto ${subpuesto_id}`);

    return {
      message: `Se eliminaron ${eliminados} turnos programados`,
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
  async rotarTurnos(subpuesto_id: number, desde?: string, hasta?: string) {
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
      asignado_por: 1 // Sistema / Rotación
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
  async regenerarTurnos(subpuesto_id: number, userId: number) {
    this.logger.log(`♻️ Regenerando turnos para subpuesto ${subpuesto_id}`);

    const fechaManana = new Date();
    fechaManana.setDate(fechaManana.getDate() + 1);
    const fechaInicioStr = fechaManana.toISOString().split('T')[0];

    // 1. Eliminar turnos futuros (desde mañana en adelante)
    const { message, eliminados } = await this.eliminarTurnos(
      subpuesto_id,
      fechaInicioStr,
      '2099-12-31' // Fecha lejana
    );

    this.logger.log(`🗑️ Se eliminaron ${eliminados} turnos futuros`);

    // 2. Generar nuevos turnos
    try {
      const resultadoGeneracion = await this.asignarTurnos({
        subpuesto_id,
        fecha_inicio: fechaInicioStr,
        asignado_por: userId
      });

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
