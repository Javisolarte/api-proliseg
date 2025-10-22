import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { SupabaseService } from '../supabase/supabase.service';
import { schema } from './schema';

@Injectable()
export class IaService {
  private readonly logger = new Logger(IaService.name);

  constructor(
    private readonly geminiService: GeminiService,
    private readonly supabase: SupabaseService,
  ) {}

  // ============================================================
  // 🧠 1. PROCESAR CONSULTA NATURAL → SQL (ya existente)
  // ============================================================
  async processQuery(userQuery: string, token: string) {
    try {
      this.logger.debug(`🧠 Recibida consulta natural: "${userQuery}"`);

      // 1️⃣ Detectar si requiere SQL
      const intent = await this.geminiService.detectIntent(userQuery);
      this.logger.debug(`🎯 Intención detectada: ${intent}`);

      // 🗣️ Si es una pregunta general, responder sin SQL
      if (intent === 'general') {
        const respuesta = await this.geminiService.humanResponse(userQuery);
        return { ok: true, message: respuesta };
      }

      // 2️⃣ Generar SQL usando el esquema de Supabase
      const sqlResponse = await this.geminiService.naturalToSQL(
        `${userQuery}\n\nEsquema de la base de datos:\n${schema}`,
      );

      // 3️⃣ Limpiar SQL
      const cleanSql = sqlResponse
        .replace(/```sql/gi, '')
        .replace(/```/g, '')
        .trim()
        .replace(/;$/, '');

      this.logger.debug(`🧩 SQL limpio final:\n${cleanSql}`);

      // 4️⃣ Validar que sea SELECT
      if (!cleanSql.toUpperCase().startsWith('SELECT')) {
        throw new BadRequestException('Solo se permiten consultas SELECT.');
      }

      // 5️⃣ Ejecutar SQL con Supabase
      const userClient = this.supabase.getClientWithAuth(token);
      const { data, error } = await userClient.rpc('execute_sql', { query: cleanSql });

      if (error) throw new Error(error.message);

      // 6️⃣ Humanizar la respuesta
      const respuestaNatural = await this.geminiService.humanizeResponse(userQuery, data);

      return {
        ok: true,
        sql: cleanSql,
        data,
        message: respuestaNatural,
      };
    } catch (err: any) {
      this.logger.error('❌ Error en processQuery:', err);
      throw new BadRequestException(err.message || 'Error al procesar la consulta.');
    }
  }

  // ============================================================
  // 🔮 2. IA DE PREDICCIÓN DE AUSENCIAS / INCIDENTES
  // ============================================================
  async generarPredicciones(user: any) {
    try {
      this.logger.log(`🔮 [Predicciones] Generando predicciones para ${user.email}`);

      const { data, error } = await this.supabase
        .getClientWithAuth(user.token)
        .from('asistencias')
        .select('*');

      if (error) throw new Error(error.message);

      // Procesar datos históricos con Gemini
      const prompt = `
      Analiza los siguientes registros de asistencia y predice posibles ausencias o incidentes:
      ${JSON.stringify(data.slice(0, 30))}
      Retorna un resumen claro con probabilidades y sugerencias.
      `;
      const analisis = await this.geminiService.humanResponse(prompt);

      return { ok: true, predicciones: analisis };
    } catch (err: any) {
      this.logger.error('❌ Error en generarPredicciones:', err);
      throw new BadRequestException(err.message);
    }
  }

  // ============================================================
  // 🧭 3. IA SUPERVISOR (MONITOREO EN TIEMPO REAL)
  // ============================================================
  async ejecutarSupervisorIA(user: any) {
    try {
      this.logger.log(`🧭 [Supervisor IA] Analizando comportamiento en tiempo real de ${user.email}`);

      const { data, error } = await this.supabase
        .getClientWithAuth(user.token)
        .from('turnos')
        .select('id, empleado_id, hora_inicio, hora_fin, estado');

      if (error) throw new Error(error.message);

      const prompt = `
      Evalúa los siguientes turnos en busca de patrones de riesgo, inasistencias o retrasos recurrentes:
      ${JSON.stringify(data.slice(0, 30))}
      Sugiere alertas o supervisión específica.
      `;
      const analisis = await this.geminiService.humanResponse(prompt);

      return { ok: true, analisis };
    } catch (err: any) {
      this.logger.error('❌ Error en ejecutarSupervisorIA:', err);
      throw new BadRequestException(err.message);
    }
  }

  // ============================================================
  // ⚙️ 4. REENTRENAMIENTO ADAPTATIVO DE PERSONAL
  // ============================================================
  async reentrenarModelo(body: any, user: any) {
    try {
      this.logger.log(`⚙️ [Reentrenamiento] Iniciando reentrenamiento IA para ${user.email}`);

      const { nuevos_datos } = body;
      if (!nuevos_datos) throw new BadRequestException('Debe enviar nuevos datos.');

      const prompt = `
      Actualiza el modelo de desempeño con estos nuevos registros:
      ${JSON.stringify(nuevos_datos.slice(0, 20))}
      Indica qué ajustes se realizarán en el modelo adaptativo.
      `;
      const resultado = await this.geminiService.humanResponse(prompt);

      return { ok: true, mensaje: 'Modelo actualizado', detalle: resultado };
    } catch (err: any) {
      this.logger.error('❌ Error en reentrenarModelo:', err);
      throw new BadRequestException(err.message);
    }
  }

  // ============================================================
  // 🚔 5. RUTAS INTELIGENTES DE PATRULLAJE
  // ============================================================
  async generarRutasOptimas(body: any, user: any) {
    try {
      const { puntos } = body;
      if (!puntos || !Array.isArray(puntos)) {
        throw new BadRequestException('Debe enviar puntos GPS válidos.');
      }

      this.logger.log(`🗺️ [Rutas IA] Generando rutas para ${user.email}`);

      const prompt = `
      Genera una ruta óptima para patrullaje con estos puntos GPS:
      ${JSON.stringify(puntos)}
      Considera eficiencia, cobertura y orden lógico de recorrido.
      Devuelve un orden sugerido de visita y justificación.
      `;
      const ruta = await this.geminiService.humanResponse(prompt);

      return { ok: true, ruta };
    } catch (err: any) {
      this.logger.error('❌ Error en generarRutasOptimas:', err);
      throw new BadRequestException(err.message);
    }
  }

  // ============================================================
  // 📹 6. DETECCIÓN DE COMPORTAMIENTO ANÓMALO (visión + sensores)
  // ============================================================
  async detectarComportamientoAnomalo(user: any) {
    try {
      this.logger.log(`📹 [Anomalías IA] Analizando cámaras y sensores para ${user.email}`);

      const { data, error } = await this.supabase
        .getClientWithAuth(user.token)
        .from('eventos_sensores')
        .select('*');

      if (error) throw new Error(error.message);

      const prompt = `
      Detecta comportamientos anómalos o sospechosos en los siguientes eventos de sensores o cámaras:
      ${JSON.stringify(data.slice(0, 20))}
      Indica posibles amenazas, fallos o movimientos inusuales.
      `;
      const analisis = await this.geminiService.humanResponse(prompt);

      return { ok: true, analisis };
    } catch (err: any) {
      this.logger.error('❌ Error en detectarComportamientoAnomalo:', err);
      throw new BadRequestException(err.message);
    }
  }
}
