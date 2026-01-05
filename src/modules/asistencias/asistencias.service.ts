import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { RegistrarEntradaDto } from './dto/registrar_entrada.dto';
import { RegistrarSalidaDto } from './dto/registrar_salida.dto';
import { calcularDistancia } from './utils/distancia.util';
import { GeminiService } from '../ia/gemini.service';

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
        tipo_turno
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

    return { turno, asignacion };
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
    const { turno } = await this.verificarPermisoAsistencia(dto.empleado_id, dto.turno_id);

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
    const now = new Date();
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
    let observacion = '';
    // Si now > turnoFechaInicio -> Tarde
    // diffMinutos es positivo si faltan minutos (temprano), negativo si ya pasó (tarde)
    const minutosTarde = Math.floor((now.getTime() - turnoFechaInicio.getTime()) / (1000 * 60));

    if (minutosTarde > 0) {
      observacion = `Llegada tarde: ${minutosTarde} min.`;
    } else {
      observacion = 'Entrada Normal.';
    }
    if (dto.observacion) observacion += ` Nota: ${dto.observacion}`;

    // 6. Registrar en turnos_asistencia
    // Si ya existía registro sin entrada (raro, pero posible si se creó el registro antes), update. Si no, insert.
    let asistenciaId = asistenciaExistente?.id;

    if (asistenciaId) {
      await db.from('turnos_asistencia').update({
        hora_entrada: now.toISOString(),
        observaciones: observacion,
        estado_asistencia: 'pendiente', // En curso
        metodo_registro: 'app'
      }).eq('id', asistenciaId);
    } else {
      const { data: newAsis, error: errAsis } = await db.from('turnos_asistencia').insert({
        turno_id: dto.turno_id,
        empleado_id: dto.empleado_id,
        hora_entrada: now.toISOString(),
        observaciones: observacion,
        registrado_por: dto.empleado_id,
        metodo_registro: 'app',
        estado_asistencia: 'pendiente'
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
      registrada_por: dto.empleado_id
    }).select().single();

    // 8. Actualizar ESTADO DEL TURNO a 'en_curso'
    await db.from('turnos').update({
      estado_turno: 'en_curso',
      // No cambiamos hora_inicio del turno, esa es la programada. Solo estado.
    }).eq('id', dto.turno_id);

    // 9. IA Analysis (Optional hook)
    // ... (Mantener lógica IA existente si se desea, o simplificar)

    return {
      message: '✅ Entrada registrada. Turno en curso.',
      observacion_generada: observacion,
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

    const { turno } = await this.verificarPermisoAsistencia((dto as any).empleado_id, dto.turno_id);

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
    const now = new Date();
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

    let observacionSalida = '';
    const minutosDespues = Math.floor((now.getTime() - turnoFechaFin.getTime()) / (1000 * 60));

    if (minutosDespues >= 5) {
      // Marcó más de 5 mins tarde
      observacionSalida = `Salida Tarde / Tiempo Extra: ${minutosDespues} min.`;
    } else {
      observacionSalida = 'Salida Normal.';
    }

    // append a observaciones existentes
    const nuevasObservaciones = (asistencia.observaciones || '') + ' | Salida: ' + observacionSalida;
    if (dto.observacion) nuevasObservaciones + ` Nota: ${dto.observacion}`;

    // 4. Actualizar turnos_asistencia
    await db.from('turnos_asistencia').update({
      hora_salida: now.toISOString(),
      observaciones: nuevasObservaciones,
      estado_asistencia: 'cumplido'
    }).eq('id', asistencia.id);

    // 5. Insertar en log 'asistencias' legacy
    await db.from('asistencias').insert({
      empleado_id: (dto as any).empleado_id,
      turno_id: dto.turno_id,
      tipo_marca: 'salida',
      timestamp: now.toISOString(),
      latitud_salida: dto.latitud,
      longitud_salida: dto.longitud,
      registrada_por: (dto as any).empleado_id
    });

    // 6. Actualizar ESTADO DEL TURNO a 'finalizado' (usaremos 'cumplido' que es el estándar en enum, o 'no_cumplido' si hay falla, pero aquí es éxito)
    // Calcular horas reales
    const fechaEntrada = new Date(asistencia.hora_entrada);
    const horasReales = (now.getTime() - fechaEntrada.getTime()) / (1000 * 60 * 60);

    await db.from('turnos').update({
      estado_turno: 'cumplido', // El usuario pidió "finalizado" pero el enum es 'cumplido'. 'finalizado' daría error constraint.
      horas_reportadas: horasReales,
      duracion_horas: horasReales
    }).eq('id', dto.turno_id);

    return {
      message: '✅ Salida registrada. Turno Finalizado.',
      observacion_salida: observacionSalida,
      horas_trabajadas: horasReales,
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

    const cumplimiento = totalTurnos > 0 ? (turnosConEntrada / totalTurnos) * 100 : 0;

    return {
      message: '📈 Métrica de cumplimiento generada correctamente',
      cumplimiento: {
        total_turnos: totalTurnos,
        turnos_con_entrada: turnosConEntrada,
        turnos_con_salida: turnosConSalida,
        porcentaje_cumplimiento: cumplimiento.toFixed(2),
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
                subpuesto:subpuesto_id(nombre)
            )
        `)
      .eq('empleado_id', empleado_id)
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);

    return data;
  }
}
