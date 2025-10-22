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
  ) {}

  // ============================================================
  // 🚪 REGISTRAR ENTRADA
  // ============================================================
  async registrarEntrada(dto: RegistrarEntradaDto) {
    const db = this.supabase.getClient();

    // 🔍 Obtener turno y últimas asistencias en paralelo
    const [turnoRes, historialRes] = await Promise.all([
      db
        .from('turnos')
        .select('id, lugar_id, lugar:lugares(nombre, latitud, longitud)')
        .eq('id', dto.turno_id)
        .single(),
      db
        .from('asistencias')
        .select('id, fecha_entrada, fecha_salida, distancia_metros')
        .eq('empleado_id', dto.empleado_id)
        .order('fecha_entrada', { ascending: false })
        .limit(5),
    ]);

    if (turnoRes.error) throw new BadRequestException(turnoRes.error.message);
    if (!turnoRes.data) throw new NotFoundException('Turno no encontrado');

    const turno = turnoRes.data;
    const lugar = Array.isArray(turno.lugar) ? turno.lugar[0] : turno.lugar; // ✅ Fix array
    const historial = historialRes.data || [];

    if (!lugar) throw new NotFoundException('Lugar asociado no encontrado');

    // 📍 Calcular distancia del empleado al lugar
    const distancia = calcularDistancia(
      parseFloat(dto.latitud),
      parseFloat(dto.longitud),
      parseFloat(lugar.latitud),
      parseFloat(lugar.longitud),
    );

    // 🧠 Analizar contexto con IA (✅ ahora usando objeto)
    const analisisIA = await this.gemini.analizarAsistencia({
      tipo: 'entrada',
      empleado_id: dto.empleado_id,
      lugar_nombre: lugar.nombre,
      distancia_metros: distancia,
      historial,
    });

    // 💾 Registrar asistencia principal
    const insertRes = await db
      .from('asistencias')
      .insert({
        empleado_id: dto.empleado_id,
        turno_id: dto.turno_id,
        latitud_entrada: dto.latitud,
        longitud_entrada: dto.longitud,
        fecha_entrada: new Date(),
        distancia_metros: distancia,
        observacion: dto.observacion || analisisIA,
      })
      .select()
      .single();

    if (insertRes.error)
      throw new BadRequestException(insertRes.error.message);

    const asistencia = insertRes.data;

    // 🔄 Registrar relación con turno
    const turnoAsistencia = await db
      .from('turnos_asistencia')
      .insert({
        turno_id: dto.turno_id,
        asistencia_id: asistencia.id,
        estado: 'EN_CURSO',
      });

    if (turnoAsistencia.error)
      this.logger.warn(
        `⚠️ No se pudo registrar en turnos_asistencia: ${turnoAsistencia.error.message}`,
      );

    // 🧩 Guardar análisis IA
    await this.registrarAnalisisIA(db, dto.empleado_id, dto.turno_id, analisisIA);

    return {
      message: '✅ Entrada registrada correctamente',
      analisis_ia: analisisIA,
      distancia_metros: distancia,
      asistencia,
    };
  }

  // ============================================================
  // 🚶‍♂️ REGISTRAR SALIDA
  // ============================================================
  async registrarSalida(dto: RegistrarSalidaDto) {
    const db = this.supabase.getClient();

    // 🔍 Buscar asistencia existente y turno asociado
    const [asistenciaRes, turnoRes] = await Promise.all([
      db
        .from('asistencias')
        .select('id, empleado_id, turno_id, latitud_entrada, longitud_entrada')
        .eq('id', dto.asistencia_id)
        .single(),
      db
        .from('turnos')
        .select('id, lugar:lugares(nombre, latitud, longitud)')
        .eq('id', dto.turno_id)
        .single(),
    ]);

    if (asistenciaRes.error)
      throw new BadRequestException(asistenciaRes.error.message);
    if (turnoRes.error) throw new BadRequestException(turnoRes.error.message);

    const asistencia = asistenciaRes.data;
    const turno = turnoRes.data;
    const lugar = Array.isArray(turno.lugar) ? turno.lugar[0] : turno.lugar; // ✅ Fix array

    if (!asistencia) throw new NotFoundException('Asistencia no encontrada');
    if (!lugar) throw new NotFoundException('Lugar no encontrado');

    // 📍 Calcular distancia de salida
    const distancia = calcularDistancia(
      parseFloat(dto.latitud),
      parseFloat(dto.longitud),
      parseFloat(lugar.latitud),
      parseFloat(lugar.longitud),
    );

    // 🧠 Analizar salida con IA (✅ ahora usando objeto)
    const analisisIA = await this.gemini.analizarAsistencia({
      tipo: 'salida',
      empleado_id: asistencia.empleado_id,
      lugar_nombre: lugar.nombre,
      distancia_metros: distancia,
    });

    // 💾 Actualizar asistencia
    const updateRes = await db
      .from('asistencias')
      .update({
        latitud_salida: dto.latitud,
        longitud_salida: dto.longitud,
        fecha_salida: new Date(),
        observacion_salida: dto.observacion || analisisIA,
      })
      .eq('id', dto.asistencia_id);

    if (updateRes.error)
      throw new BadRequestException(updateRes.error.message);

    // 🔄 Marcar turno como finalizado
    await db
      .from('turnos_asistencia')
      .update({ estado: 'FINALIZADO' })
      .eq('asistencia_id', dto.asistencia_id);

    // 🧩 Guardar análisis IA
    await this.registrarAnalisisIA(
      db,
      asistencia.empleado_id,
      asistencia.turno_id,
      analisisIA,
    );

    return {
      message: '✅ Salida registrada correctamente',
      analisis_ia: analisisIA,
      distancia_metros: distancia,
    };
  }

  // ============================================================
  // 📊 MÉTRICAS DE CUMPLIMIENTO
  // ============================================================
  async obtenerMetricaCumplimiento() {
    const db = this.supabase.getClient();
    const { data, error } = await db.rpc('calcular_cumplimiento_turnos');

    if (error) throw new BadRequestException(error.message);
    return {
      message: '📈 Métrica de cumplimiento generada correctamente',
      cumplimiento: data,
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

    const nivel = analisis.toLowerCase().includes('alto')
      ? 'alto'
      : analisis.toLowerCase().includes('medio')
      ? 'medio'
      : 'bajo';

    const { error } = await db.from('ia_comportamiento_anomalo').insert({
      empleado_id,
      turno_id,
      tipo_anomalia: 'asistencia',
      descripcion: analisis.slice(0, 500),
      nivel_alerta: nivel,
      procesado: false,
    });

    if (error)
      this.logger.warn(
        `⚠️ No se pudo guardar análisis IA: ${error.message}`,
      );

    this.logger.warn(
      `🧠 [IA] Análisis registrado (nivel: ${nivel}) para empleado ${empleado_id}`,
    );
  }
}
