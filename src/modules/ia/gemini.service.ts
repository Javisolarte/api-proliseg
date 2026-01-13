import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface ApiKeyStatus {
  key: string;
  requestCount: number;
  isBlocked: boolean;
  lastResetTime: Date;
  lastError?: string;
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private apiKeys: ApiKeyStatus[] = [];
  private currentKeyIndex: number = 0;
  private readonly MAX_REQUESTS_PER_KEY = 25;
  private readonly RESET_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 horas

  constructor() {
    this.initializeApiKeys();
    this.startResetTimer();
  }

  /**
   * 🔑 Inicializa todas las API keys disponibles desde las variables de entorno
   */
  private initializeApiKeys(): void {
    const keys: string[] = [];

    // Intentar cargar hasta 20 API keys
    for (let i = 1; i <= 20; i++) {
      const key = process.env[`GEMINI_API_KEY_${i}`];
      if (key) {
        keys.push(key);
      }
    }

    if (keys.length === 0) {
      throw new Error('❌ No se encontraron API keys de Gemini. Define al menos GEMINI_API_KEY_1 en las variables de entorno.');
    }

    this.apiKeys = keys.map((key, index) => ({
      key,
      requestCount: 0,
      isBlocked: false,
      lastResetTime: new Date(),
      lastError: undefined,
    }));

    this.logger.log(`✅ ${this.apiKeys.length} API key(s) de Gemini cargadas correctamente`);
  }

  /**
   * ⏰ Inicia un temporizador para resetear los contadores cada 24 horas
   */
  private startResetTimer(): void {
    setInterval(() => {
      this.resetAllCounters();
    }, this.RESET_INTERVAL_MS);
  }

  /**
   * 🔄 Resetea todos los contadores de peticiones
   */
  private resetAllCounters(): void {
    const now = new Date();
    this.apiKeys.forEach((apiKey, index) => {
      const timeSinceReset = now.getTime() - apiKey.lastResetTime.getTime();
      if (timeSinceReset >= this.RESET_INTERVAL_MS) {
        apiKey.requestCount = 0;
        apiKey.isBlocked = false;
        apiKey.lastResetTime = now;
        apiKey.lastError = undefined;
        this.logger.log(`🔄 Contador reseteado para API key ${index + 1}`);
      }
    });
  }

  /**
   * 🎯 Obtiene la API key actual disponible
   */
  private getCurrentApiKey(): ApiKeyStatus {
    // Intentar resetear contadores si han pasado 24 horas
    this.resetAllCounters();

    // Buscar una API key disponible
    let attempts = 0;
    while (attempts < this.apiKeys.length) {
      const currentKey = this.apiKeys[this.currentKeyIndex];

      if (!currentKey.isBlocked && currentKey.requestCount < this.MAX_REQUESTS_PER_KEY) {
        return currentKey;
      }

      // Rotar a la siguiente key
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
      attempts++;
    }

    throw new Error('❌ Todas las API keys de Gemini han alcanzado su límite. Intenta nuevamente en unas horas.');
  }

  /**
   * 🔄 Marca la API key actual como bloqueada y rota a la siguiente
   */
  private rotateToNextKey(error: string): void {
    const currentKey = this.apiKeys[this.currentKeyIndex];
    currentKey.isBlocked = true;
    currentKey.lastError = error;

    this.logger.warn(`⚠️ API key ${this.currentKeyIndex + 1} bloqueada. Rotando a la siguiente...`);
    this.logger.warn(`📊 Estado: ${currentKey.requestCount}/${this.MAX_REQUESTS_PER_KEY} peticiones usadas`);

    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;

    const nextKey = this.apiKeys[this.currentKeyIndex];
    this.logger.log(`✅ Usando API key ${this.currentKeyIndex + 1} (${nextKey.requestCount}/${this.MAX_REQUESTS_PER_KEY} peticiones usadas)`);
  }

  /**
   * 🤖 Obtiene una instancia de GoogleGenerativeAI con la API key actual
   */
  private getGenAI(): GoogleGenerativeAI {
    const apiKeyStatus = this.getCurrentApiKey();
    return new GoogleGenerativeAI(apiKeyStatus.key);
  }

  /**
   * 📊 Incrementa el contador de peticiones de la API key actual
   */
  private incrementRequestCount(): void {
    const currentKey = this.apiKeys[this.currentKeyIndex];
    currentKey.requestCount++;

    const remaining = this.MAX_REQUESTS_PER_KEY - currentKey.requestCount;
    this.logger.debug(`📊 API key ${this.currentKeyIndex + 1}: ${currentKey.requestCount}/${this.MAX_REQUESTS_PER_KEY} peticiones (${remaining} restantes)`);

    if (currentKey.requestCount >= this.MAX_REQUESTS_PER_KEY) {
      this.logger.warn(`⚠️ API key ${this.currentKeyIndex + 1} ha alcanzado el límite de peticiones`);
      this.rotateToNextKey('Límite de peticiones alcanzado');
    }
  }

  /**
   * 🔁 Ejecuta una petición a Gemini con reintentos automáticos en caso de error 429
   */
  private async executeWithRetry<T>(
    operation: (genAI: GoogleGenerativeAI) => Promise<T>,
    maxRetries: number = this.apiKeys.length
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const genAI = this.getGenAI();
        const result = await operation(genAI);
        this.incrementRequestCount();
        return result;
      } catch (error: any) {
        lastError = error;
        const errorMessage = error.message || error.toString();

        // Detectar error 429 (cuota excedida)
        if (errorMessage.includes('429') ||
          errorMessage.includes('Too Many Requests') ||
          errorMessage.includes('quota') ||
          errorMessage.includes('Quota exceeded')) {

          this.logger.error(`❌ Error 429 detectado en API key ${this.currentKeyIndex + 1}: ${errorMessage}`);
          this.rotateToNextKey(errorMessage);

          // Reintentar con la siguiente API key
          continue;
        }

        // Si es otro tipo de error, lanzarlo inmediatamente
        throw error;
      }
    }

    // Si llegamos aquí, todas las API keys fallaron
    throw new Error(`Error en la API de Gemini después de ${maxRetries} intentos: ${lastError?.message}`);
  }

  /**
   * 📊 Obtiene el estado actual de todas las API keys
   */
  getApiKeysStatus(): any {
    return {
      totalKeys: this.apiKeys.length,
      currentKeyIndex: this.currentKeyIndex + 1,
      keys: this.apiKeys.map((key, index) => ({
        keyNumber: index + 1,
        requestCount: key.requestCount,
        remaining: this.MAX_REQUESTS_PER_KEY - key.requestCount,
        isBlocked: key.isBlocked,
        lastError: key.lastError,
        lastResetTime: key.lastResetTime,
      })),
    };
  }

  /**
   * 🔍 Detecta si la consulta del usuario requiere SQL o es general/conversacional.
   */
  async detectIntent(prompt: string): Promise<'sql' | 'general'> {
    this.logger.debug(`🎯 Detectando intención para: "${prompt}"`);
    try {
      const result = await this.executeWithRetry(async (genAI) => {
        const model = genAI.getGenerativeModel({
          model: 'models/gemini-2.5-flash',
        });

        return await model.generateContent([
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
      });

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
      const result = await this.executeWithRetry(async (genAI) => {
        const model = genAI.getGenerativeModel({
          model: 'models/gemini-2.5-flash',
        });

        return await model.generateContent([
          `Eres un experto en SQL. Convierte la siguiente petición en una consulta SQL válida.
          No expliques nada, solo responde con la consulta SQL.
          Petición: "${prompt}"`,
        ]);
      });

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
      const result = await this.executeWithRetry(async (genAI) => {
        const model = genAI.getGenerativeModel({
          model: 'models/gemini-2.5-flash',
        });

        return await model.generateContent([
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
      });

      const text = result.response.text().trim();
      this.logger.debug(`💬 Respuesta humanizada:\n${text}`);
      return text;
    } catch (error: any) {
      this.logger.error('❌ Error al generar respuesta humanizada:', error);
      throw new Error(`Error en la API de Gemini: ${error.message}`);
    }
  }



  /**
   * 🤖 Analiza la asistencia (entrada o salida) del empleado
   * con IA para detectar comportamientos inusuales o riesgos.
   */
  async analizarAsistencia(params: {
    tipo: 'entrada' | 'salida';
    empleado_id: number;
    lugar_nombre: string;
    distancia_metros: number;
    historial?: any[];
  }): Promise<string> {
    const { tipo, empleado_id, lugar_nombre, distancia_metros, historial } = params;

    const prompt = `
Eres una IA experta en control de asistencia de personal de seguridad.
Analiza el siguiente evento de asistencia:

📋 Datos:
- Empleado ID: ${empleado_id}
- Lugar: ${lugar_nombre}
- Distancia respecto al punto asignado: ${distancia_metros.toFixed(2)} metros
- Tipo de registro: ${tipo}
- Historial reciente: ${JSON.stringify(historial || [])}

Indica:
1. Nivel de riesgo (bajo, medio o alto).
2. Si el comportamiento es normal o anómalo.
3. Una breve explicación del porqué.
Responde en una sola línea clara y concisa.
`;

    try {
      const result = await this.executeWithRetry(async (genAI) => {
        const model = genAI.getGenerativeModel({
          model: 'models/gemini-2.5-flash',
        });
        return await model.generateContent(prompt);
      });

      const texto = result.response.text();

      this.logger.log(`🧠 Análisis IA (${tipo}) generado correctamente para empleado ${empleado_id}`);
      return texto || 'Sin observaciones detectadas por la IA.';
    } catch (error) {
      this.logger.error('❌ Error analizando asistencia con IA', error);
      throw new Error(`Error en la API de Gemini: ${error.message}`);
    }
  }


  /**
   * 🤖 Responde de forma natural a preguntas generales (sin SQL)
   */
  async humanResponse(prompt: string): Promise<string> {
    this.logger.debug(`💭 Respondiendo pregunta general: "${prompt}"`);

    try {
      const result = await this.executeWithRetry(async (genAI) => {
        const model = genAI.getGenerativeModel({
          model: 'models/gemini-2.5-flash',
        });

        return await model.generateContent([
          `Eres un asistente de inteligencia artificial de PROLISEG LTDA, empresa de seguridad privada en Colombia.
          El usuario ha preguntado: "${prompt}".
          
          Responde de forma breve, profesional y amigable en español.
          Si te preguntan qué puedes hacer, responde: "Puedo ayudarte con todo lo que requieras de PROLISEG LTDA."`,
        ]);
      });

      const text = result.response.text().trim();
      this.logger.debug(`🧍‍♂️ Respuesta general:\n${text}`);
      return text;
    } catch (error: any) {
      this.logger.error('❌ Error generando respuesta general:', error);
      return 'Soy una IA que puede ayudarte a consultar y analizar datos del sistema con lenguaje natural.';
    }
  }
}
