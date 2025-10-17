import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly genAI: GoogleGenerativeAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('❌ GEMINI_API_KEY no está definido en las variables de entorno.');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * 🔍 Detecta si la consulta del usuario requiere SQL o es general/conversacional.
   */
  async detectIntent(prompt: string): Promise<'sql' | 'general'> {
    this.logger.debug(`🎯 Detectando intención para: "${prompt}"`);
    try {
      const model = this.genAI.getGenerativeModel({
        model: 'models/gemini-2.5-flash',
      });

      const result = await model.generateContent([
        `Analiza la siguiente consulta del usuario y responde solo con una palabra:
        "sql" si la pregunta requiere generar o ejecutar una consulta SQL,
        o "general" si es una pregunta sobre el sistema, sobre ti, o una conversación general.

        Ejemplos:
        - "¿Cuántos empleados hay?" → sql
        - "Muéstrame los clientes nuevos" → sql
        - "¿Qué puedes hacer?" → general
        - "¿Cómo funciona este sistema?" → general
        - "¿Qué base de datos usas?" → general

        Pregunta del usuario: "${prompt}"
        Responde solo con "sql" o "general".`,
      ]);

      const text = result.response.text().toLowerCase().trim();
      this.logger.debug(`🧭 Intención detectada: ${text}`);
      return text.includes('general') ? 'general' : 'sql';
    } catch (error: any) {
      this.logger.error('❌ Error detectando intención:', error);
      // Por seguridad, asumimos que requiere SQL si hay fallo
      return 'sql';
    }
  }

  /**
   * 🧠 Convierte lenguaje natural a SQL válido
   */
  async naturalToSQL(prompt: string): Promise<string> {
    this.logger.debug(`🧠 Generando SQL para: ${prompt}`);

    try {
      const model = this.genAI.getGenerativeModel({
        model: 'models/gemini-2.5-flash',
      });

      const result = await model.generateContent([
        `Eres un experto en SQL. Convierte la siguiente petición en una consulta SQL válida.
        No expliques nada, solo responde con la consulta SQL.
        Petición: "${prompt}"`,
      ]);

      const text = result.response.text().trim();
      this.logger.debug(`✅ SQL generado:\n${text}`);
      return text;
    } catch (error: any) {
      this.logger.error('❌ Error al comunicarse con Gemini:', error);
      throw new Error(`Error en la API de Gemini: ${error.message}`);
    }
  }

  /**
   * 💬 Genera una respuesta natural basada en el resultado de la base de datos
   */
  async humanizeResponse(prompt: string, dbResult: any): Promise<string> {
    this.logger.debug(`🗣️ Humanizando respuesta para: ${prompt}`);

    try {
      const model = this.genAI.getGenerativeModel({
        model: 'models/gemini-2.5-flash',
      });

      const result = await model.generateContent([
        `Eres un asistente amable y experto en análisis de datos.
        El usuario hizo la siguiente pregunta: "${prompt}".
        Este es el resultado crudo de la base de datos: ${JSON.stringify(dbResult)}.

        Tu tarea es responder en español de forma natural, útil y breve.
        Adáptate al tipo de pregunta:
        - Si pidió una lista, preséntala de forma legible.
        - Si pidió una cantidad, indícalo claramente.
        - Si pidió el más viejo o antiguo, dilo con un tono humano.
        - Si no hay resultados, responde empáticamente.

        Ejemplos:
        - "Aquí tienes la lista de empleados: Juan, Ana y Pedro. ¿Deseas que te muestre sus cargos?"
        - "La cantidad total de empleados es 14."
        - "El cliente más antiguo es José Pérez, registrado en 2012."
        - "La persona más mayor es Marta López con 72 años."
        - "No encontré información que coincida con eso. ¿Quieres que busque de otra forma?"

        No uses formato JSON, ni SQL, ni código.`,
      ]);

      const text = result.response.text().trim();
      this.logger.debug(`💬 Respuesta humanizada:\n${text}`);
      return text;
    } catch (error: any) {
      this.logger.error('❌ Error al generar respuesta humanizada:', error);
      throw new Error(`Error en la API de Gemini: ${error.message}`);
    }
  }

  /**
   * 🤖 Responde de forma natural a preguntas generales (sin SQL)
   */
  async humanResponse(prompt: string): Promise<string> {
    this.logger.debug(`💭 Respondiendo pregunta general: "${prompt}"`);

    try {
      const model = this.genAI.getGenerativeModel({
        model: 'models/gemini-2.5-flash',
      });

      const result = await model.generateContent([
        `Eres un asistente conversacional integrado en un sistema empresarial con acceso a datos el sistema empresarial es de una empresa de seguridad privada , PROLISEG LTDA presta servicioos de seguridad fija y movil en todo colombia.
        El usuario ha preguntado: "${prompt}".
        
        Si la pregunta no requiere SQL, respóndele en español de forma natural, profesional y amigable.
        Puedes explicar que eres una IA que ayuda a convertir lenguaje natural en consultas SQL para obtener datos reales.
        
        Ejemplos:
        - "Soy un asistente de inteligencia artificial que puede ayudarte a consultar los datos del sistema con lenguaje natural."
        - "Puedo responder preguntas como 'muéstrame los empleados' o 'cuántos clientes hay'."
        - "¿Quieres que te dé algunos ejemplos de lo que puedo hacer?"`,
      ]);

      const text = result.response.text().trim();
      this.logger.debug(`🧍‍♂️ Respuesta general:\n${text}`);
      return text;
    } catch (error: any) {
      this.logger.error('❌ Error generando respuesta general:', error);
      return 'Soy una IA que puede ayudarte a consultar y analizar datos del sistema con lenguaje natural.';
    }
  }
}
