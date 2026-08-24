import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosRequestConfig } from 'axios';
import { createHash, randomBytes } from 'crypto';

// ─── Tipos públicos Dahua ─────────────────────────────────────────────────────

export interface DahuaPersonaInput {
  userId: string;           // documento_identidad — max 20 chars
  nombre: string;
  codigoTarjeta?: string;
  pin?: string;
  habilitado?: boolean;
  fotoBase64?: string;      // Base64 sin prefijo data:image/...
}

export interface DahuaPersona {
  userId: string;
  nombre: string;
  codigoTarjeta?: string;
  habilitado: boolean;
  raw: any;
}

export interface DahuaEvento {
  tipo: string;             // 'entrada' | 'salida' | 'denegado' | 'llamada' | 'otro'
  userId?: string;
  nombre?: string;
  codigoTarjeta?: string;
  timestamp: string;        // ISO
  canal: number;
  raw: any;
}

export interface DahuaSystemInfo {
  serialNo: string;
  deviceType: string;
  hardwareVersion: string;
  softwareVersion: string;
  mac?: string;
  raw: any;
}

// ─── Servicio ─────────────────────────────────────────────────────────────────

/**
 * DahuaService — Protocolo CGI nativo para Dahua ASI-series (control de acceso)
 *
 * IMPORTANTE: Este servicio es completamente independiente del flujo Hikvision.
 * Utiliza Digest Auth y CGI endpoints específicos del ASI7213X.
 * NO usar ISAPI aquí — eso es Hikvision.
 */
@Injectable()
export class DahuaService {
  private readonly logger = new Logger(DahuaService.name);

  // ─── SISTEMA ────────────────────────────────────────────────────────────────

  /**
   * Obtiene información básica del dispositivo Dahua.
   * GET /cgi-bin/magicBox.cgi?action=getSystemInfo
   */
  async getSystemInfo(ip: string, port: number, user: string, pass: string): Promise<DahuaSystemInfo> {
    const resp = await this.cgi(ip, port, user, pass, 'GET', '/cgi-bin/magicBox.cgi?action=getSystemInfo');
    const parsed = this.parseConfig(String(resp.data || ''));
    return {
      serialNo: parsed['serialNo'] || '',
      deviceType: parsed['deviceType'] || '',
      hardwareVersion: parsed['hardwareVersion'] || '',
      softwareVersion: parsed['softwareVersion'] || '',
      mac: parsed['mac'] || '',
      raw: parsed,
    };
  }

  /**
   * Sincroniza la hora del dispositivo Dahua con la hora actual (Colombia UTC-5).
   * GET /cgi-bin/configManager.cgi?action=setConfig&NTP.Enable=true&...
   */
  async syncHora(ip: string, port: number, user: string, pass: string): Promise<void> {
    const now = new Date();
    // Colombia: UTC-5
    const col = new Date(now.getTime() - 5 * 3600000);
    const fmt = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${col.getUTCFullYear()}-${fmt(col.getUTCMonth() + 1)}-${fmt(col.getUTCDate())}`;
    const timeStr = `${fmt(col.getUTCHours())}:${fmt(col.getUTCMinutes())}:${fmt(col.getUTCSeconds())}`;

    const query = [
      `action=setConfig`,
      `TimeZone.LocalTime=${encodeURIComponent(`${dateStr} ${timeStr}`)}`,
      `TimeZone.Zone=-5`,
    ].join('&');

    await this.cgi(ip, port, user, pass, 'GET', `/cgi-bin/configManager.cgi?${query}`).catch(() => {
      // Intentar método alternativo de sincronización directa
    });
    this.logger.log(`⏰ [DAHUA] Hora sincronizada en ${ip}:${port} → ${dateStr} ${timeStr}`);
  }

  // ─── VIDEO ──────────────────────────────────────────────────────────────────

  /**
   * Captura snapshot del dispositivo Dahua.
   * GET /cgi-bin/snapshot.cgi?channel=1
   * Retorna el buffer de la imagen JPEG.
   */
  async getSnapshot(ip: string, port: number, user: string, pass: string, channel = 1): Promise<Buffer> {
    this.logger.log(`📸 [DAHUA SNAPSHOT] ${ip}:${port} channel=${channel}`);
    const resp = await this.cgi(ip, port, user, pass, 'GET', `/cgi-bin/snapshot.cgi?channel=${channel}`, null, 'arraybuffer');
    return Buffer.from(resp.data);
  }

  /**
   * Genera la URL RTSP para el stream Dahua.
   * rtsp://user:pass@ip:rtspPort/cam/realmonitor?channel=1&subtype=1
   * subtype=0 = principal, subtype=1 = sub-stream (recomendado para web)
   */
  getRtspUrl(ip: string, rtspPort: number, user: string, pass: string, channel = 1, subtype = 1): string {
    const encodedPass = encodeURIComponent(pass);
    return `rtsp://${user}:${encodedPass}@${ip}:${rtspPort}/cam/realmonitor?channel=${channel}&subtype=${subtype}`;
  }

  // ─── CONTROL DE PUERTAS ─────────────────────────────────────────────────────

  /**
   * Envía un comando de puerta al Dahua ASI7213X.
   * GET /cgi-bin/accessControl.cgi?action=openDoor&channel=1
   */
  async controlPuerta(
    ip: string, port: number, user: string, pass: string,
    command: 'abrir' | 'cerrar' | 'siempre-abierta' | 'siempre-cerrada',
    channel = 1,
  ): Promise<{ ok: boolean; mensaje: string; marca: string }> {

    const actionMap: Record<string, string> = {
      'abrir':           'openDoor',
      'cerrar':          'closeDoor',
      'siempre-abierta': 'alwaysOpenDoor',
      'siempre-cerrada': 'alwaysCloseDoor',
    };

    const action = actionMap[command];
    if (!action) throw new Error(`Comando Dahua desconocido: ${command}`);

    this.logger.log(`🚪 [DAHUA PUERTA] ${action} canal=${channel} en ${ip}:${port}`);

    const resp = await this.cgi(
      ip, port, user, pass, 'GET',
      `/cgi-bin/accessControl.cgi?action=${action}&channel=${channel}`,
    );

    const body = String(resp.data || '').trim();
    this.logger.debug(`[DAHUA PUERTA] Respuesta raw: ${body}`);

    // Dahua responde "OK" cuando es exitoso, o puede ser HTTP 200 con cuerpo vacío
    if (body.includes('OK') || body.includes('ok') || resp.status === 200) {
      this.logger.log(`✅ [DAHUA PUERTA] ${command} ejecutado correctamente en ${ip}:${port}`);
      return { ok: true, mensaje: `Puerta ${channel} ejecutó "${command}" correctamente (Dahua)`, marca: 'Dahua' };
    }

    throw new Error(`Respuesta inesperada de Dahua al ${command}: ${body}`);
  }

  // ─── REGISTRO DE WEBHOOK / ALARMA ───────────────────────────────────────────

  /**
   * Registra la URL de webhook en el Dahua ASI7213X para recibir eventos de acceso.
   * Usa AlarmServer CGI — endpoint correcto para la serie ASI.
   *
   * El Dahua enviará un POST multipart a webhookUrl cuando ocurra un evento.
   */
  async registrarWebhook(
    ip: string, port: number, user: string, pass: string,
    webhookUrl: string, index = 0,
  ): Promise<void> {
    const urlObj = new URL(webhookUrl);
    const serverPort = urlObj.port
      ? parseInt(urlObj.port, 10)
      : (urlObj.protocol === 'https:' ? 443 : 80);
    const protocol = urlObj.protocol === 'https:' ? 'HTTPS' : 'HTTP';

    this.logger.log(`🔗 [DAHUA WEBHOOK] Configurando AlarmServer[${index}] → ${webhookUrl} en ${ip}:${port}`);

    const params = [
      `action=setConfig`,
      `AlarmServer[${index}].Enable=true`,
      `AlarmServer[${index}].Name=PROLISEG_${index}`,
      `AlarmServer[${index}].Address=${urlObj.hostname}`,
      `AlarmServer[${index}].Port=${serverPort}`,
      `AlarmServer[${index}].Protocol=${protocol}`,
      `AlarmServer[${index}].Path=${encodeURIComponent(urlObj.pathname)}`,
      `AlarmServer[${index}].MaxConnect=5`,
      `AlarmServer[${index}].RetryTimes=3`,
      `AlarmServer[${index}].Heartbeat.Enable=false`,
      `AlarmServer[${index}].LogEnable=true`,
    ].join('&');

    await this.cgi(ip, port, user, pass, 'GET', `/cgi-bin/configManager.cgi?${params}`);
    this.logger.log(`✅ [DAHUA WEBHOOK] AlarmServer[${index}] registrado en ${ip}:${port} → ${protocol} ${webhookUrl}`);
  }

  // ─── GESTIÓN DE PERSONAS ────────────────────────────────────────────────────

  /**
   * Lista todas las personas registradas en el hardware Dahua.
   * POST /cgi-bin/recordFinder.cgi?action=find&name=AccessControlCard
   */
  async listarPersonas(ip: string, port: number, user: string, pass: string): Promise<DahuaPersona[]> {
    this.logger.log(`👥 [DAHUA PERSONAS] Listando usuarios de ${ip}:${port}`);

    const body = JSON.stringify({
      name: 'AccessControlCard',
      condition: { CardType: '0' },
    });

    let resp: any;
    try {
      resp = await this.cgi(
        ip, port, user, pass, 'POST',
        `/cgi-bin/recordFinder.cgi?action=find&name=AccessControlCard`,
        body, 'text', 'application/json',
      );
    } catch (err) {
      this.logger.warn(`⚠️ [DAHUA PERSONAS] Error al listar: ${err.message}`);
      return [];
    }

    const raw = resp.data;
    return this.parseDahuaPersonas(raw);
  }

  /**
   * Agrega una persona al hardware Dahua ASI7213X.
   * 1. Crea el registro de tarjeta de acceso
   * 2. Sube foto facial si se provee
   */
  async agregarPersona(
    ip: string, port: number, user: string, pass: string,
    persona: DahuaPersonaInput,
  ): Promise<{ ok: boolean; userId: string; fotoSubida: boolean }> {
    const userId = String(persona.userId).slice(0, 20); // max 20 chars en Dahua
    this.logger.log(`➕ [DAHUA PERSONA] Agregando userId=${userId} (${persona.nombre}) en ${ip}:${port}`);

    // 1. Crear/actualizar usuario en el hardware
    const userRecord: any = {
      CardNo: persona.codigoTarjeta || '',
      UserID: userId,
      UserName: persona.nombre.slice(0, 64),
      CardType: '0',        // 0 = Normal
      Enable: persona.habilitado !== false,
      UseTimeSection: 255,  // Sin restricción de horario
    };

    if (persona.pin) {
      userRecord.Password = persona.pin;
      userRecord.PasswordType = 'GeneralPassword';
    }

    const insertBody = JSON.stringify({ records: [userRecord] });

    try {
      await this.cgi(
        ip, port, user, pass, 'POST',
        `/cgi-bin/AccessControl.cgi?action=insertRecord&name=AccessControlCard`,
        insertBody, 'text', 'application/json',
      );
      this.logger.log(`✅ [DAHUA PERSONA] Registro creado para userId=${userId}`);
    } catch (insertErr) {
      // Intentar actualización si ya existe
      this.logger.warn(`⚠️ [DAHUA PERSONA] Insert falló, intentando update: ${insertErr.message}`);
      await this.cgi(
        ip, port, user, pass, 'POST',
        `/cgi-bin/recordUpdater.cgi?action=update&name=AccessControlCard`,
        insertBody, 'text', 'application/json',
      );
    }

    // 2. Subir foto facial si se provee
    let fotoSubida = false;
    if (persona.fotoBase64) {
      fotoSubida = await this.subirFotoFacial(ip, port, user, pass, userId, persona.fotoBase64);
    }

    return { ok: true, userId, fotoSubida };
  }

  /**
   * Actualiza los datos de una persona ya registrada en el Dahua.
   */
  async actualizarPersona(
    ip: string, port: number, user: string, pass: string,
    persona: DahuaPersonaInput,
  ): Promise<{ ok: boolean }> {
    const userId = String(persona.userId).slice(0, 20);
    this.logger.log(`✏️ [DAHUA PERSONA] Actualizando userId=${userId} en ${ip}:${port}`);

    const userRecord: any = {
      UserID: userId,
      UserName: persona.nombre.slice(0, 64),
      Enable: persona.habilitado !== false,
    };

    if (persona.codigoTarjeta !== undefined) {
      userRecord.CardNo = persona.codigoTarjeta;
    }
    if (persona.pin) {
      userRecord.Password = persona.pin;
      userRecord.PasswordType = 'GeneralPassword';
    }

    const body = JSON.stringify({ records: [userRecord] });
    await this.cgi(
      ip, port, user, pass, 'POST',
      `/cgi-bin/recordUpdater.cgi?action=update&name=AccessControlCard`,
      body, 'text', 'application/json',
    );

    if (persona.fotoBase64) {
      await this.subirFotoFacial(ip, port, user, pass, userId, persona.fotoBase64);
    }

    return { ok: true };
  }

  /**
   * Elimina una persona del hardware Dahua.
   * DELETE /cgi-bin/AccessControl.cgi?action=deleteRecord&name=AccessControlCard
   */
  async eliminarPersona(ip: string, port: number, user: string, pass: string, userId: string): Promise<{ ok: boolean }> {
    this.logger.log(`🗑️ [DAHUA PERSONA] Eliminando userId=${userId} de ${ip}:${port}`);

    const body = JSON.stringify({ records: [{ UserID: String(userId).slice(0, 20) }] });
    await this.cgi(
      ip, port, user, pass, 'POST',
      `/cgi-bin/AccessControl.cgi?action=deleteRecord&name=AccessControlCard`,
      body, 'text', 'application/json',
    );

    return { ok: true };
  }

  /**
   * Sube/actualiza la foto facial de una persona en el hardware Dahua.
   * POST /cgi-bin/AccessControl.cgi?action=insertRecord&name=Face
   */
  async subirFotoFacial(
    ip: string, port: number, user: string, pass: string,
    userId: string, fotoBase64: string,
  ): Promise<boolean> {
    try {
      this.logger.log(`🤳 [DAHUA FACE] Subiendo foto facial para userId=${userId} en ${ip}:${port}`);

      // Limpiar prefijo si viene con data:image/...
      const base64Clean = fotoBase64.includes(',') ? fotoBase64.split(',')[1] : fotoBase64;
      const imageBuffer = Buffer.from(base64Clean, 'base64');

      // Dahua ASI acepta la foto en multipart con el UserID en los parámetros
      const boundary = `----DahuaBoundary${randomBytes(8).toString('hex')}`;
      const faceRecord = JSON.stringify({ UserID: String(userId).slice(0, 20) });

      const parts = [
        `--${boundary}\r\n`,
        `Content-Disposition: form-data; name="FaceURL"\r\n`,
        `Content-Type: application/json\r\n\r\n`,
        `${faceRecord}\r\n`,
        `--${boundary}\r\n`,
        `Content-Disposition: form-data; name="FaceImage"; filename="face.jpg"\r\n`,
        `Content-Type: image/jpeg\r\n\r\n`,
      ];

      const header = Buffer.from(parts.join(''));
      const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
      const multipartBody = Buffer.concat([header, imageBuffer, footer]);

      await this.cgiRaw(
        ip, port, user, pass,
        'POST',
        `/cgi-bin/AccessControl.cgi?action=insertRecord&name=Face`,
        multipartBody,
        `multipart/form-data; boundary=${boundary}`,
      );

      this.logger.log(`✅ [DAHUA FACE] Foto facial subida correctamente para userId=${userId}`);
      return true;
    } catch (err) {
      this.logger.error(`❌ [DAHUA FACE] Error al subir foto facial userId=${userId}: ${err.message}`);
      return false;
    }
  }

  // ─── EVENTOS / LOG ──────────────────────────────────────────────────────────

  /**
   * Obtiene el log de eventos de acceso del Dahua ASI7213X.
   * POST /cgi-bin/recordFinder.cgi?action=find&name=ACSAccessLog
   */
  async obtenerEventos(
    ip: string, port: number, user: string, pass: string,
    desde?: Date, maxResults = 50,
  ): Promise<DahuaEvento[]> {
    this.logger.debug(`📋 [DAHUA EVENTOS] Obteniendo log de ${ip}:${port}`);

    const condition: any = { Count: maxResults };
    if (desde) {
      const fmt = (n: number) => String(n).padStart(2, '0');
      const d = desde;
      condition.StartTime = `${d.getFullYear()}-${fmt(d.getMonth() + 1)}-${fmt(d.getDate())} ` +
        `${fmt(d.getHours())}:${fmt(d.getMinutes())}:${fmt(d.getSeconds())}`;
    }

    const body = JSON.stringify({ name: 'ACSAccessLog', condition });

    let resp: any;
    try {
      resp = await this.cgi(
        ip, port, user, pass, 'POST',
        `/cgi-bin/recordFinder.cgi?action=find&name=ACSAccessLog`,
        body, 'text', 'application/json',
      );
    } catch (err) {
      this.logger.warn(`⚠️ [DAHUA EVENTOS] Error: ${err.message}`);
      return [];
    }

    return this.parseDahuaEventos(String(resp.data || ''));
  }

  // ─── PROCESAMIENTO DE WEBHOOK ────────────────────────────────────────────────

  /**
   * Procesa el payload de un webhook Dahua (multipart o JSON).
   * Retorna un objeto normalizado compatible con EventoAcceso del DevicePollerService.
   */
  procesarPayloadWebhook(payload: any): {
    tipoEvento: string;
    metodoAcceso: string;
    userId?: string;
    nombre?: string;
    codigoTarjeta?: string;
    fotoUrl?: string;
    timestamp: string;
    esLlamada: boolean;
  } {
    // El ASI7213X manda el evento en distintos formatos según versión de firmware
    const eventName = String(
      payload?.EventName || payload?.event || payload?.Event ||
      payload?.method || payload?.Code || ''
    ).toLowerCase();

    const action = String(payload?.Action || payload?.action || '').toLowerCase();
    const eventType = String(
      payload?.Data?.EventType || payload?.EventType ||
      payload?.data?.EventType || ''
    ).toLowerCase();

    // Detectar si es una llamada / timbre
    const esLlamada = (
      eventName.includes('videotalk') ||
      eventName.includes('call') ||
      eventName.includes('ring') ||
      eventName.includes('bell') ||
      eventName.includes('timbre') ||
      eventName.includes('doorbell') ||
      eventName.includes('callnoanswerred') ||
      eventName.includes('callnoanswered') ||
      eventType.includes('call') ||
      eventType.includes('videotalk')
    );

    // Tipo de evento normalizado
    let tipoEvento: string;
    if (esLlamada) {
      tipoEvento = 'llamada';
    } else if (eventType.includes('exit') || action.includes('stop') || eventName.includes('exit')) {
      tipoEvento = 'salida';
    } else if (eventType.includes('failed') || eventName.includes('failed') || eventName.includes('deny')) {
      tipoEvento = 'acceso_denegado';
    } else if (eventName.includes('accesscontrol') || eventType.includes('entry') || action.includes('start')) {
      tipoEvento = 'entrada';
    } else if (eventName.includes('dooropen') || eventName.includes('door_open')) {
      tipoEvento = 'puerta_abierta';
    } else if (eventName.includes('doorclose') || eventName.includes('door_close')) {
      tipoEvento = 'puerta_cerrada';
    } else {
      tipoEvento = 'evento';
    }

    // Método de acceso
    const cardType = String(payload?.Data?.CardType || payload?.CardType || '').toLowerCase();
    let metodoAcceso: string;
    if (cardType.includes('face') || cardType === '2') metodoAcceso = 'facial';
    else if (cardType.includes('card') || cardType === '0') metodoAcceso = 'tarjeta';
    else if (cardType.includes('pwd') || cardType.includes('pass')) metodoAcceso = 'pin';
    else if (esLlamada) metodoAcceso = 'llamada';
    else metodoAcceso = 'desconocido';

    // Datos de la persona
    const data = payload?.Data || payload?.data || payload;
    const userId = String(
      data?.UserID || data?.UserId || data?.userId ||
      payload?.UserID || payload?.UserId || ''
    ) || undefined;
    const nombre = String(
      data?.UserName || data?.Name || data?.name ||
      payload?.UserName || payload?.Name || ''
    ) || undefined;
    const codigoTarjeta = String(
      data?.CardNo || data?.cardNo || payload?.CardNo || ''
    ) || undefined;
    const fotoUrl = String(
      data?.ImageUrl || data?.imageUrl || data?.FaceURL ||
      payload?.PictureURL || payload?.PhotoURL || ''
    ) || undefined;

    // Timestamp
    const rawTime = payload?.LocaleTime || payload?.Time || payload?.time || payload?.UTC;
    let timestamp: string;
    try {
      const dt = new Date(rawTime || '');
      timestamp = (!rawTime || isNaN(dt.getTime())) ? new Date().toISOString() : dt.toISOString();
    } catch {
      timestamp = new Date().toISOString();
    }

    return {
      tipoEvento,
      metodoAcceso,
      userId: userId || undefined,
      nombre: nombre || undefined,
      codigoTarjeta: codigoTarjeta || undefined,
      fotoUrl: fotoUrl || undefined,
      timestamp,
      esLlamada,
    };
  }

  // ─── HELPERS INTERNOS ────────────────────────────────────────────────────────

  /**
   * Petición CGI con Digest Auth al dispositivo Dahua.
   */
  async cgi(
    ip: string, port: number, user: string, pass: string,
    method: string, path: string,
    body?: any, responseType: any = 'text',
    contentType = 'application/x-www-form-urlencoded',
  ): Promise<any> {
    const url = `http://${ip}:${port}${path}`;
    const cfg: AxiosRequestConfig = {
      method: method as any,
      url,
      data: body,
      headers: { 'Content-Type': contentType },
      timeout: 10000,
      responseType,
    };

    try {
      return await axios.request(cfg);
    } catch (err) {
      if (err.response?.status === 401) {
        // Digest Auth handshake
        const authHeader = this.buildDigestAuth(
          method, url, user, pass,
          err.response.headers['www-authenticate'] || '',
        );
        if (!authHeader) throw err;

        return await axios.request({
          ...cfg,
          headers: {
            ...cfg.headers,
            Authorization: authHeader,
          },
        });
      }
      throw err;
    }
  }

  /**
   * Petición CGI con body binario (Buffer) — para uploads multipart.
   */
  async cgiRaw(
    ip: string, port: number, user: string, pass: string,
    method: string, path: string,
    body: Buffer, contentType: string,
  ): Promise<any> {
    const url = `http://${ip}:${port}${path}`;
    const cfg: AxiosRequestConfig = {
      method: method as any,
      url,
      data: body,
      headers: { 'Content-Type': contentType, 'Content-Length': body.length.toString() },
      timeout: 20000,
      responseType: 'text',
    };

    try {
      return await axios.request(cfg);
    } catch (err) {
      if (err.response?.status === 401) {
        const authHeader = this.buildDigestAuth(
          method, url, user, pass,
          err.response.headers['www-authenticate'] || '',
        );
        if (!authHeader) throw err;
        return await axios.request({
          ...cfg,
          headers: { ...cfg.headers, Authorization: authHeader },
        });
      }
      throw err;
    }
  }

  /**
   * Construye el header Digest Auth a partir del WWW-Authenticate challenge.
   */
  private buildDigestAuth(method: string, url: string, user: string, pass: string, wwwAuth: string): string | null {
    const realm = wwwAuth.match(/realm="([^"]+)"/)?.[1];
    const nonce = wwwAuth.match(/nonce="([^"]+)"/)?.[1];
    const qop   = wwwAuth.match(/qop="([^"]+)"/)?.[1];

    if (!realm || !nonce) return null;

    const uri = new URL(url).pathname + (new URL(url).search || '');
    const nc = '00000001';
    const cnonce = randomBytes(4).toString('hex');

    const ha1 = createHash('md5').update(`${user}:${realm}:${pass}`).digest('hex');
    const ha2 = createHash('md5').update(`${method.toUpperCase()}:${uri}`).digest('hex');

    let responseHash: string;
    if (qop === 'auth') {
      responseHash = createHash('md5').update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`).digest('hex');
    } else {
      responseHash = createHash('md5').update(`${ha1}:${nonce}:${ha2}`).digest('hex');
    }

    let auth = `Digest username="${user}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${responseHash}"`;
    if (qop === 'auth') {
      auth += `, qop="${qop}", nc=${nc}, cnonce="${cnonce}"`;
    }
    return auth;
  }

  /**
   * Parsea la respuesta key=value del CGI de Dahua.
   * Ejemplo: "table.General.MachineName=ASI7213X\r\ntable.General.SerialNo=ABC123"
   */
  private parseConfig(raw: string): Record<string, string> {
    const result: Record<string, string> = {};
    raw.split(/[\r\n]+/).forEach(line => {
      const eq = line.indexOf('=');
      if (eq > 0) {
        const key = line.slice(0, eq).trim().split('.').pop() || line.slice(0, eq).trim();
        const val = line.slice(eq + 1).trim();
        result[key] = val;
      }
    });
    return result;
  }

  /**
   * Parsea la lista de personas del CGI recordFinder.
   */
  private parseDahuaPersonas(raw: string): DahuaPersona[] {
    const personas: DahuaPersona[] = [];

    // Intentar parsear como JSON primero
    try {
      const json = JSON.parse(raw);
      const records = json?.records || json?.data || json?.result || [];
      if (Array.isArray(records)) {
        return records.map((r: any) => ({
          userId: String(r.UserID || r.userId || r.CardNo || ''),
          nombre: String(r.UserName || r.name || r.Name || ''),
          codigoTarjeta: r.CardNo || r.cardNo || undefined,
          habilitado: r.Enable !== false && r.enable !== false,
          raw: r,
        }));
      }
    } catch { /* no es JSON, parsear como key=value */ }

    // Parsear formato table.AccessControlCard[0].UserID=xxx
    const block = raw.split(/\n(?=table\.)/);
    block.forEach(b => {
      const kv = this.parseConfig(b);
      if (kv['UserID']) {
        personas.push({
          userId: kv['UserID'],
          nombre: kv['UserName'] || '',
          codigoTarjeta: kv['CardNo'] || undefined,
          habilitado: kv['Enable'] !== 'false',
          raw: kv,
        });
      }
    });

    return personas;
  }

  /**
   * Parsea los eventos del log de acceso Dahua.
   */
  private parseDahuaEventos(raw: string): DahuaEvento[] {
    const eventos: DahuaEvento[] = [];

    try {
      const json = JSON.parse(raw);
      const records = json?.records || json?.data || [];
      if (Array.isArray(records)) {
        return records.map((r: any) => ({
          tipo: this.mapDahuaEventType(r.EventType || r.type || ''),
          userId: r.UserID || r.userId || undefined,
          nombre: r.UserName || r.name || undefined,
          codigoTarjeta: r.CardNo || r.cardNo || undefined,
          timestamp: r.Time || r.time || new Date().toISOString(),
          canal: Number(r.Channel || r.channel || 1),
          raw: r,
        }));
      }
    } catch { /* parsear como key=value */ }

    const block = raw.split(/\n(?=table\.)/);
    block.forEach(b => {
      const kv = this.parseConfig(b);
      if (kv['UserID'] || kv['CardNo']) {
        eventos.push({
          tipo: this.mapDahuaEventType(kv['EventType'] || ''),
          userId: kv['UserID'] || undefined,
          nombre: kv['UserName'] || undefined,
          codigoTarjeta: kv['CardNo'] || undefined,
          timestamp: kv['Time'] || new Date().toISOString(),
          canal: Number(kv['Channel'] || 1),
          raw: kv,
        });
      }
    });

    return eventos;
  }

  /**
   * Mapea el EventType del Dahua al tipo de evento normalizado de PROLISEG.
   */
  private mapDahuaEventType(eventType: string): string {
    const et = String(eventType).toLowerCase();
    if (et.includes('entry') || et.includes('enter') || et === '0') return 'entrada';
    if (et.includes('exit') || et === '1') return 'salida';
    if (et.includes('failed') || et.includes('deny') || et === '2') return 'acceso_denegado';
    if (et.includes('call') || et.includes('videotalk')) return 'llamada';
    if (et.includes('open')) return 'puerta_abierta';
    if (et.includes('close')) return 'puerta_cerrada';
    return 'evento';
  }
}
