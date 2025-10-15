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

  /**
   * Procesa una consulta del usuario.
   * Detecta si requiere SQL o solo una respuesta conversacional.
   */
  async processQuery(userQuery: string, token: string) {
    try {
      this.logger.debug(`🧠 Recibida consulta natural: "${userQuery}"`);

      // 1️⃣ Detectar si la consulta requiere SQL
      const intent = await this.geminiService.detectIntent(userQuery);
      this.logger.debug(`🎯 Intención detectada: ${intent}`);

      // 🗣️ Si es una pregunta general, responder sin SQL
      if (intent === 'general') {
        const respuesta = await this.geminiService.humanResponse(userQuery);
        this.logger.debug(`💬 Respuesta general:\n${respuesta}`);
        return { ok: true, message: respuesta };
      }

      // 2️⃣ Generar SQL con Gemini (usando el esquema)
      const sqlResponse = await this.geminiService.naturalToSQL(
        `${userQuery}\n\nEsquema de la base de datos:\n${schema}`,
      );

      // 3️⃣ Limpiar SQL
      let cleanSql = sqlResponse
        .replace(/```sql/gi, '')
        .replace(/```/g, '')
        .trim()
        .replace(/;$/, '');

      this.logger.debug(`🧩 SQL limpio final:\n${cleanSql}`);

      // 4️⃣ Validar que sea SELECT
      if (!cleanSql.toUpperCase().startsWith('SELECT')) {
        throw new BadRequestException('Solo se permiten consultas SELECT.');
      }

      // 5️⃣ Ejecutar SQL en Supabase
      const userClient = this.supabase.getClientWithAuth(token);
      const { data, error } = await userClient.rpc('execute_sql', { query: cleanSql });

      if (error) {
        this.logger.error('❌ Error ejecutando SQL:', error);
        throw new Error(error.message);
      }

      // 6️⃣ Humanizar la respuesta
      const respuestaNatural = await this.geminiService.humanizeResponse(userQuery, data);

      // 7️⃣ Devolver respuesta enriquecida
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
}
