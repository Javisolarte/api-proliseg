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
  async registrarEntrada(dto: RegistrarEntradaDto) {
    const db = this.supabase.getClient();

    // ✅ Verificar permiso de asistencia
    const { turno } = await this.verificarPermisoAsistencia(dto.empleado_id, dto.turno_id);

    // Obtener información del subpuesto y puesto
    const { data: subpuesto, error: subpuestoError } = await db
      .from('subpuestos_trabajo')
      .select(`
        id,
        nombre,
        puesto:puesto_id (
          id,
          nombre,
          latitud,
          longitud,
          direccion,
          ciudad
        )
      `)
      .eq('id', turno.subpuesto_id)
      .single();

    if (subpuestoError || !subpuesto) {
      throw new NotFoundException('Subpuesto no encontrado');
    }

    const puesto = Array.isArray(subpuesto.puesto) ? subpuesto.puesto[0] : subpuesto.puesto;

    // 📍 Calcular distancia del empleado al puesto
    let distancia = 0;
    if (puesto?.latitud && puesto?.longitud && dto.latitud && dto.longitud) {
      distancia = calcularDistancia(
        parseFloat(dto.latitud),
        parseFloat(dto.longitud),
        parseFloat(puesto.latitud),
        parseFloat(puesto.longitud),
      );
    }

    // 🔍 Obtener historial de asistencias
    const { data: historial } = await db
      .from('asistencias')
      .select('id, timestamp, tipo_marca')
      .eq('empleado_id', dto.empleado_id)
      .order('timestamp', { ascending: false })
      .limit(5);

    // 🧠 Analizar contexto con IA
    const analisisIA = await this.gemini.analizarAsistencia({
      tipo: 'entrada',
      empleado_id: dto.empleado_id,
      lugar_nombre: `${puesto?.nombre || 'Puesto'} - ${subpuesto.nombre}`,
      distancia_metros: distancia,
      historial: historial || [],
    });

    // 💾 Registrar asistencia
    const { data: asistencia, error: insertError } = await db
      .from('asistencias')
      .insert({
        empleado_id: dto.empleado_id,
        turno_id: dto.turno_id,
        tipo_marca: 'entrada',
        timestamp: new Date().toISOString(),
        latitud_entrada: dto.latitud,
        longitud_entrada: dto.longitud,
        registrada_por: dto.empleado_id, // Auto-registro
      })
      .select()
      .single();

    if (insertError) {
      this.logger.error(`Error registrando entrada: ${insertError.message}`);
      throw new BadRequestException(insertError.message);
    }

    // 🧩 Guardar análisis IA si hay anomalías
    if (analisisIA && (analisisIA.toLowerCase().includes('alto') || analisisIA.toLowerCase().includes('medio'))) {
      await this.registrarAnalisisIA(db, dto.empleado_id, dto.turno_id, analisisIA);
    }

    this.logger.log(`✅ Entrada registrada para empleado ${dto.empleado_id} en turno ${dto.turno_id}`);

    return {
      message: '✅ Entrada registrada correctamente',
      analisis_ia: analisisIA,
      distancia_metros: distancia,
      asistencia,
      subpuesto: subpuesto.nombre,
      puesto: puesto?.nombre || 'N/A',
    };
  }

  // ============================================================
  // 🚶‍♂️ REGISTRAR SALIDA
  // ============================================================
  async registrarSalida(dto: RegistrarSalidaDto) {
    const db = this.supabase.getClient();

    // ✅ Verificar permiso de asistencia
    const { turno } = await this.verificarPermisoAsistencia((dto as any).empleado_id, dto.turno_id);

    // Verificar que existe una entrada previa
    const { data: entradaPrevia, error: entradaError } = await db
      .from('asistencias')
      .select('id, timestamp')
      .eq('turno_id', dto.turno_id)
      .eq('empleado_id', (dto as any).empleado_id)
      .eq('tipo_marca', 'entrada')
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (entradaError) {
      throw new BadRequestException(entradaError.message);
    }

    if (!entradaPrevia) {
      throw new BadRequestException('No se encontró un registro de entrada previo para este turno');
    }

    // Obtener información del subpuesto y puesto
    const { data: subpuesto } = await db
      .from('subpuestos_trabajo')
      .select(`
        id,
        nombre,
        puesto:puesto_id (
          id,
          nombre,
          latitud,
          longitud
        )
      `)
      .eq('id', turno.subpuesto_id)
      .single();

    const puestoRaw = subpuesto?.puesto;
    const puesto = Array.isArray(puestoRaw) ? puestoRaw[0] : puestoRaw;

    // 📍 Calcular distancia de salida
    let distancia = 0;
    if (puesto?.latitud && puesto?.longitud && dto.latitud && dto.longitud) {
      distancia = calcularDistancia(
        parseFloat(dto.latitud),
        parseFloat(dto.longitud),
        parseFloat(puesto.latitud),
        parseFloat(puesto.longitud),
      );
    }

    // 🧠 Analizar salida con IA
    const analisisIA = await this.gemini.analizarAsistencia({
      tipo: 'salida',
      empleado_id: (dto as any).empleado_id,
      lugar_nombre: `${puesto?.nombre || 'Puesto'} - ${subpuesto?.nombre || 'Subpuesto'}`,
      distancia_metros: distancia,
    });

    // 💾 Registrar salida
    const { data: asistencia, error: insertError } = await db
      .from('asistencias')
      .insert({
        empleado_id: (dto as any).empleado_id,
        turno_id: dto.turno_id,
        tipo_marca: 'salida',
        timestamp: new Date().toISOString(),
        latitud_salida: dto.latitud,
        longitud_salida: dto.longitud,
        registrada_por: (dto as any).empleado_id,
      })
      .select()
      .single();

    if (insertError) {
      this.logger.error(`Error registrando salida: ${insertError.message}`);
      throw new BadRequestException(insertError.message);
    }

    // 🧩 Guardar análisis IA si hay anomalías
    if (analisisIA && (analisisIA.toLowerCase().includes('alto') || analisisIA.toLowerCase().includes('medio'))) {
      await this.registrarAnalisisIA(db, (dto as any).empleado_id, dto.turno_id, analisisIA);
    }

    this.logger.log(`✅ Salida registrada para empleado ${(dto as any).empleado_id} en turno ${dto.turno_id}`);

    return {
      message: '✅ Salida registrada correctamente',
      analisis_ia: analisisIA,
      distancia_metros: distancia,
      asistencia,
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
}
