import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { RegistrarEntradaDto } from './dto/registrar_entrada.dto';
import { RegistrarSalidaDto } from './dto/registrar_salida.dto';
import { UpdateAsistenciaDto, CerrarTurnoManualDto, RegistrarEntradaManualDto, RegistrarSalidaManualDto } from './dto/asistencias.dto';
import { calcularDistancia } from './utils/distancia.util';
import { GeminiService } from '../ia/gemini.service';
import { analizarAsistenciaIA } from './utils/ia.util';

/**
 * ⏰ Retorna la fecha/hora actual en zona horaria de Colombia (UTC-5)
 * El resultado es un Date cuyo valor interno ya está ajustado a UTC-5.
 */
function getColombiaTime(): Date {
  const now = new Date();
  const offsetMs = -5 * 60 * 60 * 1000; // UTC-5 en milisegundos
  return new Date(now.getTime() + now.getTimezoneOffset() * 60 * 1000 + offsetMs);
}

@Injectable()
export class AsistenciasService {
  private readonly logger = new Logger(AsistenciasService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly gemini: GeminiService,
  ) { }

  /**
   * ✅ Verificar si un empleado puede registrar asistencia
   * Solo se permite si está asignado a un subpuesto activo
   */
  async verificarPermisoAsistencia(empleado_id: number, turno_id: number) {
    const db = this.supabase.getClient();

    // Obtener el turno con su subpuesto
    const { data: turno, error: turnoError } = await db
      .from('turnos')
      .select(`
        id,
        subpuesto_id,
        empleado_id,
        fecha,
        hora_inicio,
        hora_fin,
        tipo_turno,
        empleado:empleado_id(nombre_completo)
      `)
      .eq('id', turno_id)
      .single();

    if (turnoError || !turno) {
      throw new NotFoundException('Turno no encontrado');
    }

    // Verificar que el turno pertenece al empleado
    if (turno.empleado_id !== empleado_id) {
      throw new BadRequestException('Este turno no pertenece al empleado');
    }

    // Verificar que el empleado está asignado al subpuesto
    const { data: asignacion, error: asignError } = await db
      .from('asignacion_guardas_puesto')
      .select('id, activo')
      .eq('empleado_id', empleado_id)
      .eq('subpuesto_id', turno.subpuesto_id)
      .eq('activo', true)
      .maybeSingle();

    if (asignError) {
      this.logger.error(`Error verificando asignación: ${asignError.message}`);
      throw asignError;
    }

    if (!asignacion) {
      throw new BadRequestException(
        'No tienes una asignación activa al subpuesto de este turno. Las asistencias solo se habilitan cuando estás asignado a un subpuesto.'
      );
    }

    // Normalizar empleado (por si Supabase devuelve array)
    const empData = Array.isArray(turno.empleado) ? turno.empleado[0] : turno.empleado;
    const empleadoInfo = {
      id: turno.empleado_id,
      nombre: empData?.nombre_completo || 'Empleado'
    };

    return { turno, asignacion, empleado: empleadoInfo };
  }

  // ============================================================
  // 🚪 REGISTRAR ENTRADA
  // ============================================================
  // ============================================================
  // 🚪 REGISTRAR ENTRADA
  // ============================================================
  async registrarEntrada(dto: RegistrarEntradaDto) {
    const db = this.supabase.getClient();

    // 1. Verificar permiso y datos básicos
    const { turno, empleado } = await this.verificarPermisoAsistencia(dto.empleado_id, dto.turno_id);

    // 2. Verificar duplicados en turnos_asistencia
    const { data: asistenciaExistente } = await db
      .from('turnos_asistencia')
      .select('id, hora_entrada')
      .eq('turno_id', dto.turno_id)
      .maybeSingle();

    if (asistenciaExistente && asistenciaExistente.hora_entrada) {
      throw new BadRequestException('Ya existe un registro de entrada para este turno.');
    }

    // 3. Verificar ventana de tiempo (20 minutos antes)
    const now = getColombiaTime();
    const [h, m, s] = (turno.hora_inicio || '00:00:00').split(':');
    const turnoFechaInicio = new Date(turno.fecha);
    turnoFechaInicio.setHours(parseInt(h), parseInt(m), parseInt(s || '0'));

    const diffMinutos = (turnoFechaInicio.getTime() - now.getTime()) / (1000 * 60);

    if (diffMinutos > 20) {
      throw new BadRequestException('Aún no puedes marcar entrada. Se habilita 20 minutos antes del inicio del turno.');
    }

    // 4. Validar distancia (1000m)
    const { data: subpuesto } = await db.from('subpuestos_trabajo').select('*, puesto:puesto_id(*)').eq('id', turno.subpuesto_id).single();
    if (!subpuesto) throw new NotFoundException('Subpuesto no encontrado');

    const puesto = Array.isArray(subpuesto.puesto) ? subpuesto.puesto[0] : subpuesto.puesto;
    let distancia = 0;
    if (puesto?.latitud && puesto?.longitud && dto.latitud && dto.longitud) {
      distancia = calcularDistancia(parseFloat(dto.latitud), parseFloat(dto.longitud), parseFloat(puesto.latitud), parseFloat(puesto.longitud));
    }

    if (distancia > 1000) {
      throw new BadRequestException(`Estás fuera del rango permitido (${Math.round(distancia)}m). Máximo 1000m.`);
    }

    // 5. Calcular Observación de Puntualidad
    let observaciones_calculadas = '';
    // Si now > turnoFechaInicio -> Tarde
    // diffMinutos es positivo si faltan minutos (temprano), negativo si ya pasó (tarde)
    const minutosTarde = Math.floor((now.getTime() - turnoFechaInicio.getTime()) / (1000 * 60));

    if (minutosTarde > 0) {
      observaciones_calculadas = `Llegada tarde: ${minutosTarde} min.`;
    } else {
      observaciones_calculadas = 'Entrada Normal.';
    }
    if (dto.observaciones) observaciones_calculadas += ` Nota: ${dto.observaciones}`;

    // 6. IA Analysis
    try {
      const iaRes = await analizarAsistenciaIA(this.gemini, empleado, puesto, distancia, 'entrada');
      observaciones_calculadas += ` | IA: ${iaRes}`;
    } catch (e) {
      this.logger.warn(`IA Analysis failed: ${e.message}`);
    }

    // 7. Registrar en turnos_asistencia
    // Si ya existía registro sin entrada (raro, pero posible si se creó el registro antes), update. Si no, insert.
    let asistenciaId = asistenciaExistente?.id;

    if (asistenciaId) {
      await db.from('turnos_asistencia').update({
        hora_entrada: now.toISOString(),
        observaciones: observaciones_calculadas,
        estado_asistencia: 'pendiente', // En curso
        metodo_registro: 'app',
        foto_entrada: dto.foto_url // Guardar foto entrada
      }).eq('id', asistenciaId);
    } else {
      const { data: newAsis, error: errAsis } = await db.from('turnos_asistencia').insert({
        turno_id: dto.turno_id,
        empleado_id: dto.empleado_id,
        hora_entrada: now.toISOString(),
        observaciones: observaciones_calculadas,
        registrado_por: dto.empleado_id,
        metodo_registro: 'app',
        estado_asistencia: 'pendiente',
        foto_entrada: dto.foto_url // Guardar foto entrada
      }).select().single();
      if (errAsis) throw new BadRequestException(errAsis.message);
      asistenciaId = newAsis.id;
    }

    // 7. También insertar en tabla histórica 'asistencias' (para logs de GPS y legacy support)
    const { data: logAsistencia } = await db.from('asistencias').insert({
      empleado_id: dto.empleado_id,
      turno_id: dto.turno_id,
      tipo_marca: 'entrada',
      timestamp: now.toISOString(),
      latitud_entrada: dto.latitud,
      longitud_entrada: dto.longitud,
      registrada_por: dto.empleado_id,
      evidencia_foto_url: dto.foto_url // Guardar foto en histórico
    }).select().single();
    void logAsistencia; // evitar warning de variable no usada

    // 8. Actualizar ESTADO DEL TURNO a 'parcial' (Significa En Curso según lógica usuario)
    await db.from('turnos').update({
      estado_turno: 'parcial',
      // No cambiamos hora_inicio del turno, esa es la programada. Solo estado.
    }).eq('id', dto.turno_id);

    // 9. IA Analysis (Optional hook)
    // ... (Mantener lógica IA existente si se desea, o simplificar)

    return {
      message: '✅ Entrada registrada. Turno en curso.',
      observaciones_generadas: observaciones_calculadas,
      distancia_metros: distancia,
      turnos_asistencia_id: asistenciaId
    };
  }

  // ============================================================
  // 🚶‍♂️ REGISTRAR SALIDA
  // ============================================================
  // ============================================================
  // 🚶‍♂️ REGISTRAR SALIDA
  // ============================================================
  async registrarSalida(dto: RegistrarSalidaDto) {
    const db = this.supabase.getClient();

    const { turno, empleado } = await this.verificarPermisoAsistencia((dto as any).empleado_id, dto.turno_id);

    // 1. Buscar registro en turnos_asistencia
    const { data: asistencia, error: asisError } = await db
      .from('turnos_asistencia')
      .select('*')
      .eq('turno_id', dto.turno_id)
      .eq('empleado_id', (dto as any).empleado_id)
      .single();

    if (asisError || !asistencia) {
      throw new BadRequestException('No se encontró registro de entrada para este turno en turnos_asistencia.');
    }
    if (asistencia.hora_salida) {
      throw new BadRequestException('Ya se ha registrado la salida para este turno.');
    }

    // 2. Validar Distancia
    const { data: subpuesto } = await db.from('subpuestos_trabajo').select('*, puesto:puesto_id(*)').eq('id', turno.subpuesto_id).single();
    const puesto = Array.isArray(subpuesto?.puesto) ? subpuesto.puesto[0] : subpuesto?.puesto;

    let distancia = 0;
    if (puesto?.latitud && puesto?.longitud && dto.latitud && dto.longitud) {
      distancia = calcularDistancia(parseFloat(dto.latitud), parseFloat(dto.longitud), parseFloat(puesto.latitud), parseFloat(puesto.longitud));
    }
    if (distancia > 1000) {
      throw new BadRequestException(`Estás demasiado lejos (${Math.round(distancia)}m). Máximo 1000m.`);
    }

    // 3. Calcular Observaciones de Salida
    const now = getColombiaTime();
    const [hFin, mFin, sFin] = (turno.hora_fin || '23:59:59').split(':');
    const turnoFechaFin = new Date(turno.fecha);
    turnoFechaFin.setHours(parseInt(hFin), parseInt(mFin), parseInt(sFin || '0'));
    // Ajuste turno noche
    if (turno.hora_inicio && turno.hora_fin && turno.hora_fin < turno.hora_inicio) {
      turnoFechaFin.setDate(turnoFechaFin.getDate() + 1);
    }

    const minutosParaFin = (turnoFechaFin.getTime() - now.getTime()) / (1000 * 60);
    // Si minutosParaFin > 0 -> Salió antes
    // Si minutosParaFin < 0 -> Salió después (extras/tarde)

    // Validar salida muy temprana (más de 10 mins antes)
    if (minutosParaFin > 10) {
      throw new BadRequestException('Muy temprano para salir. Solo se permite 10 minutos antes del fin.');
    }

    let observaciones_salida = '';
    const minutosDespues = Math.floor((now.getTime() - turnoFechaFin.getTime()) / (1000 * 60));

    if (minutosDespues >= 5) {
      // Marcó más de 5 mins tarde
      observaciones_salida = `Salida Tarde / Tiempo Extra: ${minutosDespues} min.`;
    } else {
      observaciones_salida = 'Salida Normal.';
    }

    // append a observaciones existentes
    let nuevasObservaciones = (asistencia.observaciones || '') + ' | Salida: ' + observaciones_salida;
    if (dto.observaciones) nuevasObservaciones += ` Nota: ${dto.observaciones}`;

    // IA Analysis
    try {
      const iaRes = await analizarAsistenciaIA(this.gemini, empleado, puesto, distancia, 'salida');
      nuevasObservaciones += ` | IA: ${iaRes}`;
    } catch (e) {
      this.logger.warn(`IA Analysis failed: ${e.message}`);
    }

    // 4. Actualizar turnos_asistencia
    await db.from('turnos_asistencia').update({
      hora_salida: now.toISOString(),
      observaciones: nuevasObservaciones,
      estado_asistencia: 'cumplido',
      foto_salida: dto.foto_url // Guardar foto salida
    }).eq('id', asistencia.id);

    // 5. Insertar en log 'asistencias' legacy
    await db.from('asistencias').insert({
      empleado_id: (dto as any).empleado_id,
      turno_id: dto.turno_id,
      tipo_marca: 'salida',
      timestamp: now.toISOString(),
      latitud_salida: dto.latitud,
      longitud_salida: dto.longitud,
      registrada_por: (dto as any).empleado_id,
      evidencia_foto_url: dto.foto_url // Guardar foto en histórico
    });
    // Log guardado, continúa flujo

    // 6. Actualizar ESTADO DEL TURNO a 'cumplido'
    // La DB se encargará de calcular horas_reportadas y duracion_horas vía trigger en turnos_asistencia
    await db.from('turnos').update({
      estado_turno: 'cumplido',
    }).eq('id', dto.turno_id);

    return {
      message: '✅ Salida registrada. Turno Finalizado.',
      observaciones_salida: observaciones_salida,
      distancia_metros: distancia
    };
  }

  /**
   * 📋 Obtener turnos con asistencias habilitadas para un empleado
   * Solo retorna turnos de subpuestos donde el empleado está asignado
   */
  async obtenerTurnosHabilitados(empleado_id: number, fecha?: string) {
    const db = this.supabase.getClient();

    let query = db
      .from('turnos')
      .select(`
        id,
        fecha,
        hora_inicio,
        hora_fin,
        tipo_turno,
        estado_turno,
        subpuesto:subpuesto_id (
          id,
          nombre,
          puesto:puesto_id (
            id,
            nombre,
            direccion,
            ciudad
          )
        ),
        asistencias:asistencias (
          id,
          tipo_marca,
          timestamp
        )
      `)
      .eq('empleado_id', empleado_id);

    if (fecha) {
      query = query.eq('fecha', fecha);
    } else {
      // Por defecto, últimos 7 días
      const hace7Dias = new Date();
      hace7Dias.setDate(hace7Dias.getDate() - 7);
      query = query.gte('fecha', hace7Dias.toISOString().split('T')[0]);
    }

    const { data: turnos, error } = await query.order('fecha', { ascending: false });

    if (error) {
      throw new BadRequestException(error.message);
    }

    // Filtrar solo turnos donde el empleado está asignado al subpuesto
    const turnosHabilitados: any[] = [];
    for (const turno of turnos || []) {
      const { data: asignacion } = await db
        .from('asignacion_guardas_puesto')
        .select('id')
        .eq('empleado_id', empleado_id)
        .eq('subpuesto_id', (turno as any).subpuesto_id)
        .eq('activo', true)
        .maybeSingle();

      if (asignacion) {
        turnosHabilitados.push({
          ...turno,
          asistencia_habilitada: true,
        });
      }
    }

    return turnosHabilitados;
  }

  // ============================================================
  // 📊 MÉTRICAS DE CUMPLIMIENTO
  // ============================================================
  async obtenerMetricaCumplimiento() {
    const db = this.supabase.getClient();

    // Obtener turnos con sus asistencias
    const { data: turnos, error } = await db
      .from('turnos')
      .select(`
        id,
        fecha,
        empleado_id,
        estado_turno,
        asistencias:asistencias (
          id,
          tipo_marca,
          timestamp
        )
      `)
      .gte('fecha', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

    if (error) {
      throw new BadRequestException(error.message);
    }

    const totalTurnos = turnos?.length || 0;
    const turnosConEntrada = turnos?.filter(t =>
      t.asistencias?.some((a: any) => a.tipo_marca === 'entrada')
    ).length || 0;
    const turnosConSalida = turnos?.filter(t =>
      t.asistencias?.some((a: any) => a.tipo_marca === 'salida')
    ).length || 0;

    // Calcular métricas adicionales desde turnos_asistencia (últimos 30 días)
    const { data: turnosAsis } = await db
      .from('turnos_asistencia')
      .select('tiempo_total_horas, horas_extras, horas_nocturnas, horas_dominicales, horas_festivas, estado_asistencia')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    const totalHoras = turnosAsis?.reduce((sum, t) => sum + (t.tiempo_total_horas || 0), 0) || 0;
    const totalExtras = turnosAsis?.reduce((sum, t) => sum + (t.horas_extras || 0), 0) || 0;
    const totalNocturnas = turnosAsis?.reduce((sum, t) => sum + (t.horas_nocturnas || 0), 0) || 0;
    const totalDominicales = turnosAsis?.reduce((sum, t) => sum + (t.horas_dominicales || 0), 0) || 0;
    const incumplimientos = turnosAsis?.filter(t => t.estado_asistencia === 'no_cumplido').length || 0;

    const cumplimiento = totalTurnos > 0 ? (turnosConEntrada / totalTurnos) * 100 : 0;

    return {
      message: '📈 Métrica de cumplimiento generada correctamente',
      cumplimiento: {
        total_turnos: totalTurnos,
        turnos_con_entrada: turnosConEntrada,
        turnos_con_salida: turnosConSalida,
        porcentaje_cumplimiento: cumplimiento.toFixed(2),
        metricas_legales: {
          total_horas_mes: totalHoras.toFixed(2),
          total_horas_extras: totalExtras.toFixed(2),
          total_horas_nocturnas: totalNocturnas.toFixed(2),
          total_horas_dominicales: totalDominicales.toFixed(2),
          incumplimientos_conteo: incumplimientos,
          porcentaje_nocturnas: totalHoras > 0 ? ((totalNocturnas / totalHoras) * 100).toFixed(2) : "0.00",
          porcentaje_dominicales: totalHoras > 0 ? ((totalDominicales / totalHoras) * 100).toFixed(2) : "0.00"
        }
      },
    };
  }

  // ============================================================
  // 🤖 Registrar resultados de IA
  // ============================================================
  private async registrarAnalisisIA(
    db: any,
    empleado_id: number,
    turno_id: number,
    analisis: string,
  ) {
    if (!analisis) return;

    // Obtener el puesto_id del turno
    const { data: turno } = await db
      .from('turnos')
      .select('puesto_id')
      .eq('id', turno_id)
      .single();

    const nivel = analisis.toLowerCase().includes('alto')
      ? 'alto'
      : analisis.toLowerCase().includes('medio')
        ? 'medio'
        : 'bajo';

    const { error } = await db.from('ia_comportamiento_anomalo').insert({
      empleado_id,
      puesto_id: turno?.puesto_id,
      tipo_anomalia: 'asistencia',
      descripcion: analisis.slice(0, 500),
      nivel_alerta: nivel,
      procesado: false,
    });

    if (error) {
      this.logger.warn(`⚠️ No se pudo guardar análisis IA: ${error.message}`);
    } else {
      this.logger.log(`🧠 [IA] Análisis registrado (nivel: ${nivel}) para empleado ${empleado_id}`);
    }
  }

  // ============================================================
  // 📋 LISTAR ASISTENCIAS POR EMPLEADO
  // ============================================================
  async findAllByEmpleado(empleado_id: number) {
    const db = this.supabase.getClient();

    // Consultamos la tabla principal usada ahora: turnos_asistencia
    const { data, error } = await db
      .from('turnos_asistencia')
      .select(`
            *,
            turno:turno_id(
                id,
                fecha,
                hora_inicio,
                hora_fin,
                subpuesto:subpuesto_id(
                  id,
                  nombre,
                  puesto:puesto_id(id, nombre)
                )
            )
        `)
      .eq('empleado_id', empleado_id)
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);

    return data;
  }

  // ============================================================
  // 📝 ACTUALIZAR ASISTENCIA
  // ============================================================
  async update(id: number, dto: UpdateAsistenciaDto) {
    const db = this.supabase.getClient();

    const { data, error } = await db
      .from('turnos_asistencia')
      .update({
        ...dto,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // ============================================================
  // 🗑️ ELIMINAR ASISTENCIA
  // ============================================================
  async remove(id: number) {
    const db = this.supabase.getClient();

    const { error } = await db
      .from('turnos_asistencia')
      .delete()
      .eq('id', id);

    if (error) throw new BadRequestException(error.message);
    return { message: `Asistencia con ID ${id} eliminada correctamente` };
  }

  // ============================================================
  // 🔒 CERRAR TURNO MANUALMENTE
  // ============================================================
  async cerrarTurnoManual(dto: CerrarTurnoManualDto) {
    const db = this.supabase.getClient();

    // 1. Buscar registro de entrada
    const { data: asistencia, error: asisError } = await db
      .from('turnos_asistencia')
      .select('*')
      .eq('turno_id', dto.turno_id)
      .eq('empleado_id', dto.empleado_id)
      .maybeSingle();

    if (asisError) throw new BadRequestException(asisError.message);

    const now = dto.hora_salida || getColombiaTime().toISOString();

    if (asistencia) {
      // 2. Actualizar salida
      await db.from('turnos_asistencia')
        .update({
          hora_salida: now,
          observaciones: (asistencia.observaciones || '') + ' | Cierre manual: ' + (dto.observaciones || ''),
          estado_asistencia: 'cumplido'
        })
        .eq('id', asistencia.id);
    } else {
      // Si no hay entrada, creamos registro con hora Colombia
      await db.from('turnos_asistencia').insert({
        turno_id: dto.turno_id,
        empleado_id: dto.empleado_id,
        hora_salida: now,
        observaciones: 'Cierre manual sin registro previo de entrada. ' + (dto.observaciones || ''),
        estado_asistencia: 'cumplido',
        metodo_registro: 'manual'
      });
    }

    // 3. Actualizar estado del turno
    await db.from('turnos').update({
      estado_turno: 'cumplido'
    }).eq('id', dto.turno_id);

    return { message: '✅ Turno cerrado manualmente.' };
  }

  // ============================================================
  // 📊 RESUMEN DEL TURNO (Calculado por DB)
  // ============================================================
  async getTurnoResumen(turno_id: number) {
    const db = this.supabase.getClient();

    const { data, error } = await db
      .from('turnos_asistencia')
      .select(`
        id,
        hora_entrada,
        hora_salida,
        estado_asistencia,
        tiempo_total_minutos,
        tiempo_total_horas,
        horas_normales,
        horas_extras,
        horas_nocturnas,
        horas_diurnas,
        horas_dominicales,
        horas_festivas,
        minutos_tolerancia
      `)
      .eq('turno_id', turno_id)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('No se encontró resumen de asistencia para este turno');

    return {
      horas_totales: data.tiempo_total_horas,
      minutos_totales: data.tiempo_total_minutos,
      horas_nocturnas: data.horas_nocturnas,
      horas_diurnas: data.horas_diurnas,
      horas_extras: data.horas_extras,
      horas_normales: data.horas_normales,
      dominical: (data.horas_dominicales || 0) > 0,
      festivo: (data.horas_festivas || 0) > 0,
      minutos_tolerancia: data.minutos_tolerancia,
      estado: data.estado_asistencia
    };
  }

  // ============================================================
  // 📜 HISTORIAL LABORAL POR EMPLEADO
  // ============================================================
  async getHistorialLaboral(empleado_id: number) {
    const db = this.supabase.getClient();

    const { data, error } = await db
      .from('turnos_asistencia')
      .select(`
        id,
        turno_id,
        hora_entrada,
        hora_salida,
        estado_asistencia,
        tiempo_total_horas,
        horas_extras,
        horas_nocturnas,
        horas_dominicales,
        horas_festivas,
        turno:turno_id (
          fecha,
          subpuesto:subpuesto_id (nombre)
        )
      `)
      .eq('empleado_id', empleado_id)
      .order('hora_entrada', { ascending: false });

    if (error) throw new BadRequestException(error.message);

    return data;
  }

  // ============================================================
  // 🏢 OBTENER PUESTOS CON ASISTENCIA
  // ============================================================
  async getPuestosConAsistencia() {
    const db = this.supabase.getClient();

    // Consultamos puestos que tengan al menos un turno con asistencia
    // Nota: Usamos una subconsulta o un join para filtrar puestos. 
    // Para simplificar, obtenemos todos los puestos y adjuntamos un conteo de asistencias recientes.
    const { data: puestos, error } = await db
      .from('puestos')
      .select(`
        id,
        nombre,
        direccion,
        ciudad,
        subpuestos:subpuestos_trabajo (
          id,
          nombre,
          turnos:turnos (
            id,
            asistencias:turnos_asistencia (id)
          )
        )
      `);

    if (error) throw new BadRequestException(error.message);

    // Procesar para devolver una lista limpia con conteos
    return puestos.map(p => {
      let totalAsistencias = 0;
      p.subpuestos.forEach(s => {
        s.turnos.forEach(t => {
          totalAsistencias += t.asistencias.length;
        });
      });

      return {
        id: p.id,
        nombre: p.nombre,
        direccion: p.direccion,
        ciudad: p.ciudad,
        total_asistencias: totalAsistencias
      };
    }).filter(p => p.total_asistencias > 0);
  }

  // ============================================================
  // 📍 LISTAR ASISTENCIAS POR PUESTO (Con filtros de fecha)
  // ============================================================
  async getAsistenciasByPuesto(puesto_id: number, fecha_inicio?: string, fecha_fin?: string) {
    const db = this.supabase.getClient();

    let query = db
      .from('turnos_asistencia')
      .select(`
        *,
        empleado:empleado_id (
          id,
          nombre_completo,
          cedula
        ),
        turno:turno_id (
          id,
          fecha,
          hora_inicio,
          hora_fin,
          subpuesto:subpuesto_id (
            id,
            nombre,
            puesto:puesto_id (id, nombre)
          )
        )
      `)
      .not('turno', 'is', null);

    if (fecha_inicio) query = query.gte('hora_entrada', fecha_inicio);
    if (fecha_fin) query = query.lte('hora_entrada', fecha_fin);

    const { data, error } = await query.order('hora_entrada', { ascending: false });

    if (error) throw new BadRequestException(error.message);

    // Filtrar manualmente por puesto_id
    return data.filter(a => a.turno?.subpuesto?.puesto?.id === puesto_id);
  }

  // ============================================================
  // 🖥️ MONITOREO DE HOY
  // ============================================================
  async getMonitoreoHoy() {
    const db = this.supabase.getClient();
    const hoy = new Date().toISOString().split('T')[0];

    // 1. Obtener todos los turnos programados para hoy
    const { data: turnos, error } = await db
      .from('turnos')
      .select(`
        id,
        hora_inicio,
        hora_fin,
        estado_turno,
        empleado:empleado_id (id, nombre_completo),
        subpuesto:subpuesto_id (
          id,
          nombre,
          puesto:puesto_id (id, nombre)
        ),
        asistencia:turnos_asistencia (
          id,
          hora_entrada,
          hora_salida,
          estado_asistencia
        )
      `)
      .eq('fecha', hoy);

    if (error) throw new BadRequestException(error.message);

    // 2. Clasificar turnos
    const ahora = new Date();

    const resumen = {
      total: turnos?.length || 0,
      en_sitio: 0,
      completados: 0,
      tarde: 0,
      ausentes: 0,
      pendientes_iniciar: 0,
      novedades: [] as any[]
    };

    const detalle = turnos?.map(t => {
      const asistencia = Array.isArray(t.asistencia) ? t.asistencia[0] : t.asistencia;
      let status = 'pendiente';

      if (asistencia) {
        if (asistencia.hora_salida) {
          status = 'completado';
          resumen.completados++;
        } else {
          status = 'en_sitio';
          resumen.en_sitio++;
        }
      } else {
        // Verificar si ya debería haber llegado
        const [h, m] = t.hora_inicio.split(':');
        const start = new Date();
        start.setHours(parseInt(h), parseInt(m), 0);

        if (ahora > start) {
          status = 'ausente';
          resumen.ausentes++;
        } else {
          status = 'pendiente';
          resumen.pendientes_iniciar++;
        }
      }

      const empleado = Array.isArray(t.empleado) ? t.empleado[0] : t.empleado;
      const subpuesto = Array.isArray(t.subpuesto) ? t.subpuesto[0] : t.subpuesto;
      const subpuestoPuesto = Array.isArray(subpuesto?.puesto) ? subpuesto.puesto[0] : subpuesto?.puesto;

      if (status === 'ausente') {
        resumen.novedades.push({
          empleado: empleado?.nombre_completo,
          puesto: subpuestoPuesto?.nombre,
          tipo: 'Inasistencia',
          desde: t.hora_inicio
        });
      }

      return {
        turno_id: t.id,
        empleado: empleado?.nombre_completo,
        puesto: subpuestoPuesto?.nombre,
        subpuesto: subpuesto?.nombre,
        hora_inicio: t.hora_inicio,
        hora_fin: t.hora_fin,
        status,
        hora_entrada: asistencia?.hora_entrada || null
      };
    });

    return { resumen, detalle };
  }

  // ============================================================
  // 🚪 REGISTRAR ENTRADA MANUAL (Sin GPS)
  // ============================================================
  async registrarEntradaManual(dto: RegistrarEntradaManualDto) {
    const db = this.supabase.getClient();
    const now = getColombiaTime();

    // 1. Verificar permiso
    await this.verificarPermisoAsistencia(dto.empleado_id, dto.turno_id);

    // 2. Registrar en turnos_asistencia
    const { data: attendance, error } = await db.from('turnos_asistencia').insert({
      turno_id: dto.turno_id,
      empleado_id: dto.empleado_id,
      hora_entrada: now.toISOString(),
      observaciones: `Registro manual (Super Usuario). ${dto.observaciones || ''}`,
      registrado_por: dto.empleado_id,
      metodo_registro: 'manual',
      estado_asistencia: 'pendiente'
    }).select().single();

    if (error) throw new BadRequestException(error.message);

    // 3. Registrar en log legacy
    await db.from('asistencias').insert({
      empleado_id: dto.empleado_id,
      turno_id: dto.turno_id,
      tipo_marca: 'entrada',
      timestamp: now.toISOString(),
      registrada_por: dto.empleado_id
    });

    // 4. Actualizar turno
    await db.from('turnos').update({
      estado_turno: 'parcial'
    }).eq('id', dto.turno_id);

    return {
      message: '✅ Entrada manual registrada exitosamente.',
      asistencia: attendance
    };
  }

  // ============================================================
  // 🚶‍♂️ REGISTRAR SALIDA MANUAL (Sin GPS)
  // ============================================================
  async registrarSalidaManual(dto: RegistrarSalidaManualDto) {
    const db = this.supabase.getClient();
    // Usar hora colombiana (UTC-5) en lugar de hora UTC del servidor
    const now = getColombiaTime();

    // 1. Buscar registro de entrada — usar maybeSingle para no lanzar error si no existe
    const { data: asistencia, error: asisError } = await db
      .from('turnos_asistencia')
      .select('*')
      .eq('turno_id', dto.turno_id)
      .eq('empleado_id', dto.empleado_id)
      .maybeSingle();

    if (asisError) throw new BadRequestException(asisError.message);

    let updated: any;

    if (asistencia) {
      // 2a. Existe registro previo — solo actualizar la salida
      const { data, error } = await db.from('turnos_asistencia').update({
        hora_salida: now.toISOString(),
        observaciones: (asistencia.observaciones || '') + ` | Salida manual (Super Usuario). ${dto.observaciones || ''}`,
        estado_asistencia: 'cumplido'
      }).eq('id', asistencia.id).select().single();
      if (error) throw new BadRequestException(error.message);
      updated = data;
    } else {
      // 2b. No existe registro previo — crear uno con solo salida (turno forzado)
      const { data, error } = await db.from('turnos_asistencia').insert({
        turno_id: dto.turno_id,
        empleado_id: dto.empleado_id,
        hora_salida: now.toISOString(),
        observaciones: `Salida manual sin registro de entrada (Super Usuario). ${dto.observaciones || ''}`,
        estado_asistencia: 'cumplido',
        metodo_registro: 'manual',
        registrado_por: dto.empleado_id,
      }).select().single();
      if (error) throw new BadRequestException(error.message);
      updated = data;
      this.logger.warn(`⚠️ Salida manual registrada sin entrada previa para turno ${dto.turno_id}, empleado ${dto.empleado_id}`);
    }

    // 3. Registrar en log legacy
    await db.from('asistencias').insert({
      empleado_id: dto.empleado_id,
      turno_id: dto.turno_id,
      tipo_marca: 'salida',
      timestamp: now.toISOString(),
      registrada_por: dto.empleado_id
    });

    // 4. Actualizar estado del turno
    await db.from('turnos').update({
      estado_turno: 'cumplido'
    }).eq('id', dto.turno_id);

    return {
      message: '✅ Salida manual registrada exitosamente.',
      asistencia: updated
    };
  }

  // ============================================================
  // 📸 SUBIR FOTO EVIDENCIA
  // ============================================================
  async uploadFoto(file: any, empleado_id: number) {
    if (!file) throw new BadRequestException("No se ha subido ningún archivo");

    const db = this.supabase.getClient();
    const timestamp = Date.now();
    // Clean filename
    const name = file.originalname.split('.')[0].replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const ext = file.originalname.split('.').pop();
    const path = `${empleado_id}/${timestamp}_${name}.${ext}`;

    const { data, error } = await db.storage
      .from('asistencias-fotos')
      .upload(path, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (error) {
      this.logger.error(`Error subiendo foto asistencia: ${error.message}`);
      throw new BadRequestException("Error al subir la evidencia fotográfica");
    }

    // Get Public URL
    const { data: { publicUrl } } = db.storage
      .from('asistencias-fotos')
      .getPublicUrl(path);

    return { url: publicUrl };
  }
}
