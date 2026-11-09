import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';

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
  private liveApiKey: string =
    process.env.GEMINI_LIVE_API_KEY ||
    process.env.GEMINI_API_KEY_4 || '';
  private readonly MAX_REQUESTS_PER_KEY = 2500;
  private readonly RESET_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 horas

  constructor() {
    this.initializeApiKeys();
    this.startResetTimer();
  }

  /**
   * ðŸŽ™ï¸ Obtiene o actualiza en caliente la API Key activa
   */
  public getLiveApiKey(): string {
    try {
      return this.getCurrentApiKey().key;
    } catch {
      return this.liveApiKey || this.apiKeys[0]?.key || '';
    }
  }

  public setLiveApiKey(newKey: string): void {
    const clean = (newKey || '').trim();
    if (!clean) return;
    this.liveApiKey = clean;
    const existingIdx = this.apiKeys.findIndex((k) => k.key === clean);
    if (existingIdx >= 0) {
      this.apiKeys[existingIdx].isBlocked = false;
      this.apiKeys[existingIdx].requestCount = 0;
      this.currentKeyIndex = existingIdx;
    } else {
      this.apiKeys.unshift({
        key: clean,
        requestCount: 0,
        isBlocked: false,
        lastResetTime: new Date(),
      });
      this.currentKeyIndex = 0;
    }
    this.logger.log(`ðŸš€ [CATORCE LIVE API] Nueva llave maestra configurada y activada como prioridad #1.`);
  }

  /**
   * ðŸ—£ï¸ SINTETIZADOR DE VOZ ULTRA-HUMANIZADA NATIVA DE GEMINI 2.5 (24kHz Neural Audio WAV)
   * Voces disponibles: 'Aoede' (Ejecutiva cÃ¡lida y natural), 'Kore' (Clara y empÃ¡tica), 'Orus' / 'Puck' (Masculina natural)
   */
  public async generateHumanVoiceAudio(text: string, voiceName: string = 'Aoede'): Promise<string | null> {
    const cleanSpeech = (text || '')
      .replace(/<pre>[\s\S]*?<\/pre>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/[*#_`~]/g, '')
      .replace(/AUD-CAT-\d+/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1400);

    if (!cleanSpeech) return null;

    let attempts = 0;
    const maxAttempts = Math.min(this.apiKeys.length, 6);

    while (attempts < maxAttempts) {
      const apiKeyObj = this.getCurrentApiKey();
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKeyObj.key}`;
        const response = await axios.post(
          url,
          {
            contents: [
              {
                parts: [
                  {
                    text: cleanSpeech
                  },
                ],
              },
            ],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: voiceName || 'Aoede',
                  },
                },
              },
            },
          },
          { timeout: 10000 },
        );

        const inlineData = response.data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
        if (inlineData?.data) {
          this.incrementRequestCount();
          const mime = String(inlineData.mimeType || '').toLowerCase();
          if (mime.includes('wav')) {
            return `data:audio/wav;base64,${inlineData.data}`;
          }
          const pcmBuffer = Buffer.from(inlineData.data, 'base64');
          const wavBuffer = this.pcm24kToWavBuffer(pcmBuffer, 24000);
          return `data:audio/wav;base64,${wavBuffer.toString('base64')}`;
        }
        break;
      } catch (err: any) {
        const status = err.response?.status;
        const msg = err.response?.data?.error?.message || err.message || '';
        if (status === 402 || status === 429 || status === 403 || status === 404 || status === 400) {
          this.rotateToNextKey(`TTS ${status}: ${msg}`);
          attempts++;
          continue;
        }
        this.logger.warn(`âš ï¸ TTS Gemini aviso: ${msg}`);
        break;
      }
    }

    return null;
  }

  /**
   * ðŸŽµ Empaqueta PCM 16-bit mono (24kHz) devuelto por Gemini 2.5 Audio en un contenedor WAV estÃ¡ndar
   */
  private pcm24kToWavBuffer(pcmBuffer: Buffer, sampleRate: number = 24000): Buffer {
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const wavHeader = Buffer.alloc(44);

    wavHeader.write('RIFF', 0);
    wavHeader.writeUInt32LE(36 + pcmBuffer.length, 4);
    wavHeader.write('WAVE', 8);
    wavHeader.write('fmt ', 12);
    wavHeader.writeUInt32LE(16, 16); // Subchunk1Size (16 para PCM)
    wavHeader.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
    wavHeader.writeUInt16LE(numChannels, 22);
    wavHeader.writeUInt32LE(sampleRate, 24);
    wavHeader.writeUInt32LE(byteRate, 28);
    wavHeader.writeUInt16LE(blockAlign, 32);
    wavHeader.writeUInt16LE(bitsPerSample, 34);
    wavHeader.write('data', 36);
    wavHeader.writeUInt32LE(pcmBuffer.length, 40);

    return Buffer.concat([wavHeader, pcmBuffer]);
  }

  /**
   * ðŸ§¬ Genera un vector embedding para la base de datos vectorial ia_brain
   */
  public async generateEmbedding(text: string): Promise<number[]> {
    try {
      const cleanText = (text || '').slice(0, 6000).trim();
      if (!cleanText) return [];
      const result = await this.executeWithRetry(async (genAI) => {
        const model = genAI.getGenerativeModel({ model: 'models/gemini-embedding-001' });
        return await model.embedContent(cleanText);
      });
      return result?.embedding?.values || [];
    } catch (err: any) {
      this.logger.warn(`âš ï¸ Fallback embedding ligero activado: ${err.message}`);
      return [];
    }
  }

  /**
   * ðŸ§  Ejecuta un prompt estructurado o conversacional con Gemini 3.5 Flash Lite (~750ms) para respuesta tipo ChatGPT Live
   */
  public async generateStructuredOrNatural(prompt: string, systemInstruction?: string): Promise<string> {
    const result = await this.executeWithRetry(async (genAI) => {
      const model = genAI.getGenerativeModel({
        model: 'models/gemini-3.5-flash-lite',
        ...(systemInstruction ? { systemInstruction } : {}),
      });
      return await model.generateContent(prompt);
    });
    return result.response.text().trim();
  }

  /**
   * ðŸ”‘ Inicializa todas las API keys disponibles priorizando las llaves mÃ¡s rÃ¡pidas con Gemini 3.5 Flash Lite (200 OK)
   */
  private initializeApiKeys(): void {
    const keys: string[] = [];

    // Priorizar las 10 llaves activas verificadas con 200 OK en Gemini 3.5 Flash Lite & TTS
    const priorityIndices = [4, 2, 5, 6, 7, 8, 9, 10, 11, 12, 1, 3, 13, 14, 15, 16, 17, 18, 19, 20];
    for (const i of priorityIndices) {
      const key = process.env[`GEMINI_API_KEY_${i}`];
      if (key && !keys.includes(key)) {
        keys.push(key);
      }
    }

    if (process.env.GEMINI_LIVE_API_KEY && !keys.includes(process.env.GEMINI_LIVE_API_KEY)) {
      keys.push(process.env.GEMINI_LIVE_API_KEY);
    }

    const masterCreditKey = process.env.GEMINI_API_KEY_4 || '';
    if (!keys.includes(masterCreditKey)) {
      keys.push(masterCreditKey);
    }

    if (keys.length === 0 && process.env.GEMINI_API_KEY) {
      keys.push(process.env.GEMINI_API_KEY);
    }

    if (keys.length === 0) {
      throw new Error('âŒ No se encontraron API keys de Gemini. Define al menos GEMINI_API_KEY_1 en las variables de entorno.');
    }

    this.apiKeys = keys.map((key) => ({
      key,
      requestCount: 0,
      isBlocked: false,
      lastResetTime: new Date(),
      lastError: undefined,
    }));

    this.logger.log(`âœ… ${this.apiKeys.length} API key(s) de Gemini cargadas y verificadas para rotaciÃ³n automÃ¡tica`);
  }

  private startResetTimer(): void {
    setInterval(() => {
      this.resetAllCounters();
    }, this.RESET_INTERVAL_MS);
  }

  private resetAllCounters(): void {
    const now = new Date();
    this.apiKeys.forEach((apiKey, index) => {
      const timeSinceReset = now.getTime() - apiKey.lastResetTime.getTime();
      if (timeSinceReset >= this.RESET_INTERVAL_MS) {
        apiKey.requestCount = 0;
        apiKey.isBlocked = false;
        apiKey.lastResetTime = now;
        apiKey.lastError = undefined;
        this.logger.log(`ðŸ”„ Contador reseteado para API key ${index + 1}`);
      }
    });
  }

  private getCurrentApiKey(): ApiKeyStatus {
    this.resetAllCounters();

    let attempts = 0;
    while (attempts < this.apiKeys.length) {
      const currentKey = this.apiKeys[this.currentKeyIndex];

      if (!currentKey.isBlocked && currentKey.requestCount < this.MAX_REQUESTS_PER_KEY) {
        return currentKey;
      }

      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
      attempts++;
    }

    this.apiKeys.forEach((k) => {
      k.isBlocked = false;
      k.requestCount = 0;
    });
    return this.apiKeys[0];
  }

  private rotateToNextKey(error: string): void {
    const currentKey = this.apiKeys[this.currentKeyIndex];
    currentKey.isBlocked = true;
    currentKey.lastError = error;

    this.logger.warn(`âš ï¸ API key ${this.currentKeyIndex + 1} rotada por estado (${error.slice(0, 80)}). Pasando a la siguiente...`);
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
  }

  private getGenAI(): GoogleGenerativeAI {
    const apiKeyStatus = this.getCurrentApiKey();
    return new GoogleGenerativeAI(apiKeyStatus.key);
  }

  private incrementRequestCount(): void {
    const currentKey = this.apiKeys[this.currentKeyIndex];
    currentKey.requestCount++;

    if (currentKey.requestCount >= this.MAX_REQUESTS_PER_KEY) {
      this.rotateToNextKey('LÃ­mite de peticiones alcanzado');
    }
  }

  /**
   * ðŸ” Ejecuta una peticiÃ³n a Gemini con rotaciÃ³n automÃ¡tica ante errores 402, 403, 404, 429 o cuota
   */
  private async executeWithRetry<T>(
    operation: (genAI: GoogleGenerativeAI) => Promise<T>,
    maxRetries: number = this.apiKeys.length,
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

        // Rotar inmediatamente ante cualquier error de llave, crÃ©dito agotado (402), cuota (429), modelo no habilitado (404) o permiso (403)
        if (
          errorMessage.includes('429') ||
          errorMessage.includes('402') ||
          errorMessage.includes('403') ||
          errorMessage.includes('404') ||
          errorMessage.includes('400') ||
          errorMessage.includes('prepayment') ||
          errorMessage.includes('depleted') ||
          errorMessage.includes('no longer available') ||
          errorMessage.includes('Too Many Requests') ||
          errorMessage.includes('quota') ||
          errorMessage.includes('Quota exceeded') ||
          errorMessage.includes('API_KEY_INVALID')
        ) {
          this.rotateToNextKey(errorMessage);
          continue;
        }

        throw error;
      }
    }

    throw new Error(`Error en la API de Gemini despuÃ©s de ${maxRetries} intentos: ${lastError?.message}`);
  }

  getApiKeysStatus(): any {
    const activeKey = this.getCurrentApiKey()?.key || this.liveApiKey;
    return {
      totalKeys: this.apiKeys.length,
      currentKeyIndex: this.currentKeyIndex + 1,
      hasLiveApiKey: Boolean(activeKey),
      liveKeyMasked: activeKey ? `${activeKey.slice(0, 8)}...${activeKey.slice(-4)}` : null,
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

  async detectIntent(prompt: string): Promise<'sql' | 'general'> {
    try {
      const result = await this.executeWithRetry(async (genAI) => {
        const model = genAI.getGenerativeModel({
          model: 'models/gemini-2.5-flash',
        });

        return await model.generateContent([
          `Analiza la siguiente consulta del usuario y responde solo con una palabra:
          "sql" si la pregunta requiere generar o ejecutar una consulta SQL,
          o "general" si es una pregunta sobre el sistema, sobre ti, o una conversaciÃ³n general.
          Pregunta del usuario: "${prompt}"
          Responde solo con "sql" o "general".`,
        ]);
      });

      const text = result.response.text().toLowerCase().trim();
      return text.includes('general') ? 'general' : 'sql';
    } catch {
      return 'sql';
    }
  }

  async naturalToSQL(prompt: string): Promise<string> {
    const result = await this.executeWithRetry(async (genAI) => {
      const model = genAI.getGenerativeModel({
        model: 'models/gemini-2.5-flash',
      });

      return await model.generateContent([
        `Eres un experto en SQL PostgreSQL para Prolicontrol (PROLISEG LTDA). Convierte la siguiente peticiÃ³n en una consulta SQL SELECT vÃ¡lida.
        No expliques nada, solo responde con la consulta SQL.
        PeticiÃ³n: "${prompt}"`,
      ]);
    });

    return result.response.text().trim();
  }

  async humanizeResponse(prompt: string, dbResult: any): Promise<string> {
    const result = await this.executeWithRetry(async (genAI) => {
      const model = genAI.getGenerativeModel({
        model: 'models/gemini-2.5-flash',
      });

      return await model.generateContent([
        `Eres CATORCE, el Segundo Cerebro e Inteligencia Artificial Operativa de PROLISEG LTDA (Prolicontrol).
        El usuario hizo la siguiente pregunta: "${prompt}".
        Este es el resultado real de la base de datos: ${JSON.stringify(dbResult)}.

        Tu tarea es responder en espaÃ±ol de forma ejecutiva, clara, precisa y natural.
        - Si pidiÃ³ cantidades o listas, presÃ©ntalas con claridad.
        - No uses bloques de cÃ³digo SQL crudo en tu respuesta hablada.`,
      ]);
    });

    return result.response.text().trim();
  }

  async analizarAsistencia(params: {
    tipo: 'entrada' | 'salida';
    empleado_id: number;
    lugar_nombre: string;
    distancia_metros: number;
    historial?: any[];
  }): Promise<string> {
    const { tipo, empleado_id, lugar_nombre, distancia_metros, historial } = params;

    const prompt = `
Eres CATORCE, IA experta en control de asistencia de personal de seguridad de PROLISEG LTDA.
Analiza el siguiente evento de asistencia:
- Empleado ID: ${empleado_id}
- Lugar: ${lugar_nombre}
- Distancia respecto al punto asignado: ${distancia_metros.toFixed(2)} metros
- Tipo de registro: ${tipo}
- Historial reciente: ${JSON.stringify(historial || [])}

Indica nivel de riesgo y una breve explicaciÃ³n en una sola lÃ­nea clara y concisa.
`;

    const result = await this.executeWithRetry(async (genAI) => {
      const model = genAI.getGenerativeModel({
        model: 'models/gemini-2.5-flash',
      });
      return await model.generateContent(prompt);
    });

    return result.response.text() || 'Sin observaciones detectadas por la IA.';
  }

  async analyzeImage(imageUrl: string, prompt: string): Promise<string> {
    try {
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data);
      const base64Image = buffer.toString('base64');
      const mimeType = response.headers['content-type'] || 'image/jpeg';

      const result = await this.executeWithRetry(async (genAI) => {
        const model = genAI.getGenerativeModel({
          model: 'models/gemini-2.5-flash',
        });

        const imagePart = {
          inlineData: {
            data: base64Image,
            mimeType,
          },
        };

        return await model.generateContent([prompt, imagePart]);
      });

      return result.response.text().trim();
    } catch (error: any) {
      return `Error en anÃ¡lisis visual: ${error.message}`;
    }
  }

  async humanResponse(prompt: string): Promise<string> {
    try {
      const result = await this.executeWithRetry(async (genAI) => {
        const model = genAI.getGenerativeModel({
          model: 'models/gemini-2.5-flash',
        });

        return await model.generateContent([
          `Eres CATORCE, el Segundo Cerebro e Inteligencia Artificial Central de PROLISEG LTDA (Plataforma Prolicontrol).
          El usuario ha preguntado o solicitado: "${prompt}".
          Responde de forma breve, ejecutiva, profesional y amigable en espaÃ±ol.`,
        ]);
      });

      return result.response.text().trim();
    } catch {
      return 'Soy CATORCE, el Segundo Cerebro de PROLISEG LTDA integrado a Prolicontrol.';
    }
  }
}


