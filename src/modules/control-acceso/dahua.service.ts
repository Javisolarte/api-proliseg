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
  cardRecno?: number;
  habilitado: boolean;
  recno?: number;
  validFrom?: string;
  validTo?: string;
  raw?: any;
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
  private readonly digestCache = new Map<string, { realm: string; nonce: string; qop?: string }>();

  /**
   * Ejecuta peticiones HTTP CGI autenticadas con Digest Auth nativo hacia dispositivos Dahua.
   */
  async cgi(
    ip: string,
    port: number,
    user: string,
    pass: string,
    method: 'GET' | 'POST' = 'GET',
    path: string,
    data?: any,
    responseType: any = 'text',
    contentType: string = 'application/x-www-form-urlencoded',
    timeout: number = 10000,
  ): Promise<any> {
    const url = `http://${ip}:${port}${path}`;
    const host = `${ip}:${port}`;
    const cached = this.digestCache.get(host);

    const headers: Record<string, string> = { 'Content-Type': contentType };

    if (cached) {
      const { realm, nonce, qop } = cached;
      const nc = '00000001';
      const cnonce = randomBytes(4).toString('hex');
      const uri = path;
      const ha1 = createHash('md5').update(`${user}:${realm}:${pass}`).digest('hex');
      const ha2 = createHash('md5').update(`${method}:${uri}`).digest('hex');
      let responseHash = '';
      if (qop === 'auth') {
        responseHash = createHash('md5').update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`).digest('hex');
      } else {
        responseHash = createHash('md5').update(`${ha1}:${nonce}:${ha2}`).digest('hex');
      }

      let authStr = `Digest username="${user}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${responseHash}"`;
      if (qop === 'auth') {
        authStr += `, qop="${qop}", nc=${nc}, cnonce="${cnonce}"`;
      }

      headers['Authorization'] = authStr;

      try {
        return await axios.request({
          method,
          url,
          data,
          headers,
          responseType,
          timeout,
        });
      } catch (err: any) {
        if (err?.response?.status === 401) {
          this.digestCache.delete(host);
        } else {
          throw err;
        }
      }
    }

    try {
      return await axios.request({ method, url, data, headers, responseType, timeout });
    } catch (err: any) {
      if (err?.response?.status === 401 && err?.response?.headers?.['www-authenticate']) {
        const authHeader = err.response.headers['www-authenticate'];
        const matchRealm = authHeader.match(/realm="([^"]+)"/);
        const matchNonce = authHeader.match(/nonce="([^"]+)"/);
        const matchQop = authHeader.match(/qop="([^"]+)"/);

        if (matchRealm && matchNonce) {
          const realm = matchRealm[1];
          const nonce = matchNonce[1];
          const qop = matchQop ? (matchQop[1].includes('auth') ? 'auth' : matchQop[1].split(',')[0].trim()) : '';

          this.digestCache.set(host, { realm, nonce, qop });

          const nc = '00000001';
          const cnonce = randomBytes(4).toString('hex');
          const uri = path;
          const ha1 = createHash('md5').update(`${user}:${realm}:${pass}`).digest('hex');
          const ha2 = createHash('md5').update(`${method}:${uri}`).digest('hex');
          let responseHash = '';
          if (qop === 'auth') {
            responseHash = createHash('md5').update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`).digest('hex');
          } else {
            responseHash = createHash('md5').update(`${ha1}:${nonce}:${ha2}`).digest('hex');
          }

          let authStr = `Digest username="${user}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${responseHash}"`;
          if (qop === 'auth') {
            authStr += `, qop="${qop}", nc=${nc}, cnonce="${cnonce}"`;
          }

          headers['Authorization'] = authStr;

          return await axios.request({
            method,
            url,
            data,
            headers,
            responseType,
            timeout,
          });
        }
      }
      throw err;
    }
  }

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

  /**
   * Configura la compresión de video del Dahua en H.264 y audio en G.711A (necesario para compatibilidad WebRTC HTML5 en navegadores).
   * GET /cgi-bin/configManager.cgi?action=setConfig&Encode[0].MainFormat[0].Video.Compression=H.264...
   */
  async asegurarFormatoH264(ip: string, port: number, user: string, pass: string): Promise<void> {
    try {
      const query = [
        'action=setConfig',
        'Encode[0].MainFormat[0].Video.Compression=H.264',
        'Encode[0].ExtraFormat[0].Video.Compression=H.264',
        'Encode[0].MainFormat[0].Video.GOP=25',
        'Encode[0].ExtraFormat[0].Video.GOP=25',
        'Encode[0].MainFormat[0].AudioEnable=true',
        'Encode[0].ExtraFormat[0].AudioEnable=true',
        'Encode[0].MainFormat[0].Audio.Compression=G.711A',
        'Encode[0].MainFormat[0].Audio.Frequency=8000',
        'Encode[0].MainFormat[0].Audio.Bitrate=64',
        'Encode[0].ExtraFormat[0].Audio.Compression=G.711A',
        'Encode[0].ExtraFormat[0].Audio.Frequency=8000',
        'Encode[0].ExtraFormat[0].Audio.Bitrate=64',
        'Encode[1].MainFormat[0].Video.Compression=H.264',
        'Encode[1].ExtraFormat[0].Video.Compression=H.264',
        'Encode[1].MainFormat[0].Video.GOP=25',
        'Encode[1].ExtraFormat[0].Video.GOP=25',
        'Encode[1].MainFormat[0].AudioEnable=true',
        'Encode[1].ExtraFormat[0].AudioEnable=true',
        'Encode[1].MainFormat[0].Audio.Compression=G.711A',
        'Encode[1].MainFormat[0].Audio.Frequency=8000',
        'Encode[1].MainFormat[0].Audio.Bitrate=64',
        'Encode[1].ExtraFormat[0].Audio.Compression=G.711A',
        'Encode[1].ExtraFormat[0].Audio.Frequency=8000',
        'Encode[1].ExtraFormat[0].Audio.Bitrate=64',
      ].join('&');
      await this.cgi(ip, port, user, pass, 'GET', `/cgi-bin/configManager.cgi?${query}`);
      this.logger.log(`📹 [DAHUA ENCODE] Formato H.264 (GOP=25) + Audio G.711A (8000Hz) configurado en ${ip}:${port}`);
    } catch (err: any) {
      this.logger.warn(`⚠️ [DAHUA ENCODE] No se pudo forzar H.264/GOP/G.711A vía CGI: ${err.message}`);
    }
  }

  /**
   * Configura el volumen del altavoz físico y avisos de voz en el hardware Dahua (0-10) y desmutea.
   */
  async ajustarVolumenAltavoz(ip: string, port: number, user: string, pass: string, volumen = 8): Promise<void> {
    try {
      const query = [
        'action=setConfig',
        `Volume.VoicePrompt=${volumen}`,
        `Volume.Call=${volumen}`,
        `Volume.Beep=${volumen}`,
        `AudioOut[0].Volume=${volumen * 10}`,
        `Speaker.Volume=${volumen * 10}`,
        `VoicePrompt.Enable=true`
      ].join('&');
      await this.cgi(ip, port, user, pass, 'GET', `/cgi-bin/configManager.cgi?${query}`);
      this.logger.log(`🔊 [DAHUA VOLUMEN] Altavoz desmuteado y volumen fijado en ${volumen}/10 en ${ip}:${port}`);
    } catch (e: any) {
      this.logger.warn(`⚠️ [DAHUA VOLUMEN] Nota al ajustar volumen: ${e.message}`);
    }
  }

  /**
   * Obtiene un header de Digest Auth válido para un endpoint Dahua.
   * Hace un request de prueba para provocar el 401 y extraer el challenge.
   */
  async getDigestHeader(
    ip: string, port: number, user: string, pass: string,
    method: string, path: string,
  ): Promise<string | null> {
    const url = `http://${ip}:${port}${path}`;
    try {
      // Intentar sin auth para provocar 401
      await axios.request({ method: 'GET', url, timeout: 5000, validateStatus: () => true }).then(resp => {
        if (resp.status === 401 && resp.headers['www-authenticate']) {
          throw { response: resp };
        }
      });
      return null;
    } catch (err: any) {
      if (err?.response?.status === 401 || err?.response?.headers?.['www-authenticate']) {
        const wwwAuth = err.response.headers['www-authenticate'] || '';
        return this.buildDigestAuth(method.toUpperCase(), url, user, pass, wwwAuth);
      }
      // Intento alternativo: usar un endpoint conocido para obtener el challenge
      try {
        const probeUrl = `http://${ip}:${port}/cgi-bin/global.cgi?action=getCurrentTime`;
        const probe = await axios.get(probeUrl, { timeout: 5000, validateStatus: () => true });
        if (probe.status === 401 && probe.headers['www-authenticate']) {
          return this.buildDigestAuth(method.toUpperCase(), url, user, pass, probe.headers['www-authenticate']);
        }
      } catch {}
      return null;
    }
  }

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
   * Agrega una persona al hardware Dahua ASI7213X.
   * 1. Crea el registro de usuario en AccessUserInfo
   * 2. Crea el registro de tarjeta en AccessControlCard
   * 3. Sube foto facial vía JSON-RPC nativo (AccessFaceInfo) si se provee
   */
  async agregarPersona(
    ip: string, port: number, user: string, pass: string,
    persona: DahuaPersonaInput,
  ): Promise<{ ok: boolean; userId: string; recno?: number; fotoSubida: boolean }> {
    const userId = String(persona.userId).slice(0, 20); // max 20 chars en Dahua
    const cardNo = (persona.codigoTarjeta || userId).slice(0, 32);
    const cardName = (persona.nombre || `Usuario ${userId}`).slice(0, 32);
    this.logger.log(`➕ [DAHUA PERSONA] Agregando userId=${userId} (${cardName}) en ${ip}:${port}`);

    // 1. Crear el Usuario en AccessUserInfo (necesario para que Dahua reconozca el rostro y permisos)
    const userParams = [
      'action=insert',
      'name=AccessUserInfo',
      `UserID=${encodeURIComponent(userId)}`,
      `UserName=${encodeURIComponent(cardName)}`,
      `UserType=0`,
      `UserStatus=0`,
      `Authority=0`,
      `Doors[0]=0`,
      `TimeSections[0]=255`,
      `ValidFrom=${encodeURIComponent('2020-01-01 00:00:00')}`,
      `ValidTo=${encodeURIComponent('2037-12-31 23:59:59')}`,
    ];

    await this.cgi(ip, port, user, pass, 'GET', `/cgi-bin/recordUpdater.cgi?${userParams.join('&')}`).catch(() => {});

    // 2. Crear la tarjeta en AccessControlCard
    const cardParams = [
      'action=insert',
      'name=AccessControlCard',
      `CardNo=${encodeURIComponent(cardNo)}`,
      `UserID=${encodeURIComponent(userId)}`,
      `CardName=${encodeURIComponent(cardName)}`,
      `CardStatus=0`,
      `CardType=0`,
      `Doors[0]=0`,
      `TimeSections[0]=255`,
      `IsValid=${persona.habilitado !== false}`,
      `ValidDateStart=${encodeURIComponent('2020-01-01 00:00:00')}`,
      `ValidDateEnd=${encodeURIComponent('2037-12-31 23:59:59')}`,
    ];

    if (persona.pin) {
      cardParams.push(`Password=${encodeURIComponent(persona.pin)}`);
    }

    let recno: number | undefined;
    try {
      const resp = await this.cgi(
        ip, port, user, pass, 'GET',
        `/cgi-bin/recordUpdater.cgi?${cardParams.join('&')}`,
      );
      const respText = String(resp.data || '');
      this.logger.log(`✅ [DAHUA PERSONA] Tarjeta creada en ${ip}:${port}: ${respText.trim()}`);
      
      const recnoMatch = respText.match(/RecNo=(\d+)/i);
      if (recnoMatch) {
        recno = parseInt(recnoMatch[1], 10);
      }
    } catch (insertErr: any) {
      this.logger.warn(`⚠️ [DAHUA PERSONA] Nota en AccessControlCard: ${insertErr.message}`);
    }

    // 3. Subir foto facial vía JSON-RPC nativo
    let fotoSubida = false;
    if (persona.fotoBase64) {
      fotoSubida = await this.subirFotoFacial(ip, port, user, pass, userId, persona.fotoBase64);
    }

    return { ok: true, userId, recno, fotoSubida };
  }

  /**
   * Actualiza los datos de una persona ya registrada en el Dahua.
   */
  async actualizarPersona(
    ip: string, port: number, user: string, pass: string,
    persona: DahuaPersonaInput,
  ): Promise<{ ok: boolean; recno?: number }> {
    const userId = String(persona.userId).slice(0, 20);
    const cardNo = (persona.codigoTarjeta || userId).slice(0, 32);
    const cardName = (persona.nombre || `Usuario ${userId}`).slice(0, 32);
    this.logger.log(`✏️ [DAHUA PERSONA] Actualizando userId=${userId} en ${ip}:${port}`);

    // 1. Actualizar AccessUserInfo
    const userParams = [
      'action=insert',
      'name=AccessUserInfo',
      `UserID=${encodeURIComponent(userId)}`,
      `UserName=${encodeURIComponent(cardName)}`,
      `UserType=0`,
      `UserStatus=0`,
      `Authority=0`,
      `Doors[0]=0`,
      `TimeSections[0]=255`,
    ];
    await this.cgi(ip, port, user, pass, 'GET', `/cgi-bin/recordUpdater.cgi?${userParams.join('&')}`).catch(() => {});

    // 2. Buscar recno del usuario en AccessControlCard
    const existentes = await this.listarPersonas(ip, port, user, pass);
    const coincidencia = existentes.find(
      p => String(p.userId) === String(userId) || String(p.codigoTarjeta) === String(cardNo)
    );

    let recno = coincidencia?.recno;
    if (recno !== undefined) {
      const queryParams = [
        'action=update',
        'name=AccessControlCard',
        `recno=${recno}`,
        `CardNo=${encodeURIComponent(cardNo)}`,
        `UserID=${encodeURIComponent(userId)}`,
        `CardName=${encodeURIComponent(cardName)}`,
        `CardStatus=0`,
        `Doors[0]=0`,
        `TimeSections[0]=255`,
        `IsValid=${persona.habilitado !== false}`,
      ];

      if (persona.pin) {
        queryParams.push(`Password=${encodeURIComponent(persona.pin)}`);
      }

      await this.cgi(
        ip, port, user, pass, 'GET',
        `/cgi-bin/recordUpdater.cgi?${queryParams.join('&')}`,
      ).catch(() => {});
    }

    if (persona.fotoBase64) {
      await this.subirFotoFacial(ip, port, user, pass, userId, persona.fotoBase64);
    }

    return { ok: true, recno };
  }

  /**
   * Lista todos los usuarios y tarjetas registrados en el hardware Dahua (AccessUserInfo y AccessControlCard).
   */
  async listarPersonas(ip: string, port: number, user: string, pass: string): Promise<any[]> {
    try {
      this.logger.log(`📋 [DAHUA LISTAR] Consultando usuarios y tarjetas en ${ip}:${port}...`);
      const [usersRes, cardsRes] = await Promise.all([
        this.cgi(ip, port, user, pass, 'GET', '/cgi-bin/recordFinder.cgi?action=find&name=AccessUserInfo&count=200').catch(() => null),
        this.cgi(ip, port, user, pass, 'GET', '/cgi-bin/recordFinder.cgi?action=find&name=AccessControlCard&count=200').catch(() => null),
      ]);

      const parseCgiKv = (text: string) => {
        const records: Record<number, any> = {};
        for (const line of (text || '').split('\n')) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const match = trimmed.match(/^records\[(\d+)\]\.(.+?)=(.*)$/);
          if (match) {
            const idx = parseInt(match[1], 10);
            const key = match[2];
            const val = match[3];
            if (!records[idx]) records[idx] = { recno: idx };
            records[idx][key] = val;
          }
        }
        return Object.values(records);
      };

      const userRecords = parseCgiKv(usersRes?.data || '');
      const cardRecords = parseCgiKv(cardsRes?.data || '');

      const cardMap = new Map<string, { cardNo: string; recno: number }>();
      for (const c of cardRecords) {
        if (c.UserID && c.CardNo) {
          cardMap.set(String(c.UserID).trim(), {
            cardNo: String(c.CardNo).trim(),
            recno: Number(c.RecNo || c.recno),
          });
        }
      }

      return userRecords
        .filter(u => u.UserID)
        .map(u => ({
          recno: Number(u.RecNo || u.recno),
          userId: String(u.UserID).trim(),
          nombre: String(u.UserName || '').trim(),
          codigoTarjeta: cardMap.get(String(u.UserID).trim())?.cardNo,
          cardRecno: cardMap.get(String(u.UserID).trim())?.recno,
          habilitado: u.UserStatus === '0' || u.UserStatus === 0,
          validFrom: u.ValidFrom,
          validTo: u.ValidTo,
        }));
    } catch (err) {
      this.logger.error(`❌ [DAHUA LISTAR] Error al listar personas de ${ip}:${port}: ${err.message}`);
      return [];
    }
  }

  /**
   * Elimina una persona del hardware Dahua (AccessUserInfo y AccessControlCard).
   */
  async eliminarPersona(ip: string, port: number, user: string, pass: string, userId: string): Promise<{ ok: boolean }> {
    const userIdClean = String(userId).trim().slice(0, 20);
    this.logger.log(`🗑️ [DAHUA PERSONA] Eliminando userId=${userIdClean} de ${ip}:${port}`);

    const existentes = await this.listarPersonas(ip, port, user, pass);
    const coincidencia = existentes.find(
      p => String(p.userId) === userIdClean || String(p.codigoTarjeta) === userIdClean
    );

    // 1. Eliminar de AccessControlCard
    if (coincidencia && coincidencia.cardRecno !== undefined) {
      await this.cgi(
        ip, port, user, pass, 'GET',
        `/cgi-bin/recordUpdater.cgi?action=remove&name=AccessControlCard&recno=${coincidencia.cardRecno}`,
      ).catch(() => {});
    }

    // 2. Eliminar de AccessUserInfo
    if (coincidencia && coincidencia.recno !== undefined) {
      await this.cgi(
        ip, port, user, pass, 'GET',
        `/cgi-bin/recordUpdater.cgi?action=remove&name=AccessUserInfo&recno=${coincidencia.recno}`,
      ).catch(() => {});
    }

    return { ok: true };
  }

  /**
   * Normaliza una imagen facial a JPEG estándar baseline para compatibilidad con el motor de IA Dahua ASI.
   */
  private normalizeFaceJpeg(inputBuffer: Buffer): Promise<Buffer> {
    return new Promise((resolve) => {
      let bin = 'ffmpeg';
      try {
        const fs = require('fs');
        const ffmpegStatic = require('ffmpeg-static');
        if (typeof ffmpegStatic === 'string' && fs.existsSync(ffmpegStatic)) {
          bin = ffmpegStatic;
        }
      } catch {}

      const { spawn } = require('child_process');
      const proc = spawn(bin, [
        '-i', 'pipe:0',
        '-vf', 'scale=480:640:force_original_aspect_ratio=increase,crop=480:640',
        '-pix_fmt', 'yuvj420p',
        '-map_metadata', '-1',
        '-q:v', '2',
        '-f', 'image2',
        '-vcodec', 'mjpeg',
        'pipe:1'
      ]);

      const chunks: Buffer[] = [];
      proc.stdout.on('data', (d: Buffer) => chunks.push(d));
      proc.on('close', (code: number) => {
        if (code === 0 && chunks.length > 0) resolve(Buffer.concat(chunks));
        else resolve(inputBuffer);
      });
      proc.on('error', () => resolve(inputBuffer));
      proc.stdin.write(inputBuffer);
      proc.stdin.end();
    });
  }

  /**
   * Sube/actualiza la foto facial de una persona en el hardware Dahua ASI7213X vía método nativo AccessFace.insertMulti.
   */
  async subirFotoFacial(
    ip: string, port: number, user: string, pass: string,
    userId: string, fotoBase64: string,
  ): Promise<boolean> {
    try {
      this.logger.log(`🤳 [DAHUA FACE] Subiendo foto facial para userId=${userId} en ${ip}:${port}`);

      // Limpiar prefijo data:image/... y normalizar a JPEG compatible
      const rawBase64 = fotoBase64.includes(',') ? fotoBase64.split(',')[1] : fotoBase64;
      const rawBuf = Buffer.from(rawBase64, 'base64');
      const normBuf = await this.normalizeFaceJpeg(rawBuf);
      const base64Clean = normBuf.toString('base64');

      const uIdStr = String(userId).slice(0, 20);

      // 1. Usar el método nativo AccessFace.insertMulti
      const insertRes = await this.rpcCall(ip, port, user, pass, 'AccessFace.insertMulti', {
        FaceList: [
          {
            UserID: uIdStr,
            PhotoData: [base64Clean],
          }
        ]
      }).catch(() => null);

      if (insertRes?.result) {
        this.logger.log(`✅ [DAHUA FACE] Foto facial registrada exitosamente en hardware Dahua para userId=${userId}`);
        return true;
      }

      // 2. Si ya existía, intentar AccessFace.updateMulti
      const updateRes = await this.rpcCall(ip, port, user, pass, 'AccessFace.updateMulti', {
        FaceList: [
          {
            UserID: uIdStr,
            PhotoData: [base64Clean],
          }
        ]
      }).catch(() => null);

      if (updateRes?.result) {
        this.logger.log(`✅ [DAHUA FACE] Foto facial actualizada exitosamente en hardware Dahua para userId=${userId}`);
        return true;
      }

      this.logger.warn(`⚠️ [DAHUA FACE] Dahua no pudo indexar la foto para userId=${userId}: ${JSON.stringify(insertRes?.error || updateRes?.error)}`);
      return false;
    } catch (err: any) {
      this.logger.error(`❌ [DAHUA FACE] Error al subir foto facial userId=${userId}: ${err.message}`);
      return false;
    }
  }

  /**
   * Ejecuta llamadas JSON-RPC autenticadas al endpoint /RPC2_Login y /RPC2 de Dahua.
   */
  async rpcCall(ip: string, port: number, user: string, pass: string, method: string, params: any = null, objectId?: number): Promise<any> {
    const baseUrl = `http://${ip}:${port}`;

    // Step 1: Challenge
    const step1 = await axios.post(`${baseUrl}/RPC2_Login`, {
      method: 'global.login',
      params: { userName: user, password: '', clientType: 'Web3.0' },
      id: 1,
    }, { timeout: 6000 });

    const step1Data = step1.data;
    if (!step1Data?.params) {
      throw new Error(`Dahua RPC2 challenge falló`);
    }

    const { realm, random } = step1Data.params;
    const sessionId = step1Data.session;

    // Step 2: Response hash
    const ha1 = createHash('md5').update(`${user}:${realm}:${pass}`).digest('hex').toUpperCase();
    const finalPass = createHash('md5').update(`${user}:${random}:${ha1}`).digest('hex').toUpperCase();

    const step2 = await axios.post(`${baseUrl}/RPC2_Login`, {
      method: 'global.login',
      params: {
        userName: user,
        password: finalPass,
        clientType: 'Web3.0',
        authorityType: 'Default',
      },
      session: sessionId,
      id: 2,
    }, { timeout: 6000 });

    if (!step2.data?.result) {
      throw new Error(`Dahua RPC2 login rechazado`);
    }

    // Step 3: Execute method
    const rpcPayload: any = {
      method,
      params,
      session: sessionId,
      id: 3,
    };
    if (objectId !== undefined) {
      rpcPayload.object = objectId;
    }

    const methodResp = await axios.post(`${baseUrl}/RPC2`, rpcPayload, { timeout: 10000 });
    return methodResp.data;
  }

  // ─── EVENTOS / LOG ──────────────────────────────────────────────────────────

  /**
   * Obtiene el log de eventos de acceso del Dahua ASI7213X.
   * GET /cgi-bin/recordFinder.cgi?action=find&name=AccessControlCardRec&count=50
   */
  async obtenerEventos(
    ip: string, port: number, user: string, pass: string,
    desde?: Date, maxResults = 50,
  ): Promise<DahuaEvento[]> {
    this.logger.debug(`📋 [DAHUA EVENTOS] Obteniendo log de ${ip}:${port}`);

    const tables = ['AccessControlCardRec', 'AccessRecord'];
    for (const table of tables) {
      try {
        const resp = await this.cgi(
          ip, port, user, pass, 'GET',
          `/cgi-bin/recordFinder.cgi?action=find&name=${table}&count=${maxResults}`,
        );
        const raw = String(resp.data || '');
        if (raw && !raw.toLowerCase().includes('error')) {
          const eventos = this.parseDahuaEventos(raw);
          if (eventos.length > 0) return eventos;
        }
      } catch (err: any) {
        this.logger.debug(`⚠️ [DAHUA EVENTOS] Tabla ${table} no disponible: ${err.message}`);
      }
    }

    // Fallback: log.cgi
    try {
      const resp = await this.cgi(
        ip, port, user, pass, 'GET',
        `/cgi-bin/log.cgi?action=getLog&count=${maxResults}`,
      );
      const raw = String(resp.data || '');
      if (raw && !raw.toLowerCase().includes('error')) {
        return this.parseDahuaEventos(raw);
      }
    } catch {}

    return [];
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
    const opaque = wwwAuth.match(/opaque="([^"]+)"/)?.[1];

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
    if (opaque) {
      auth += `, opaque="${opaque}"`;
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
    const rawStr = String(raw || '');
    const personasMap = new Map<number, any>();

    // 1. Intentar parsear como JSON primero
    try {
      const json = JSON.parse(rawStr);
      const records = json?.records || json?.data || json?.result || [];
      if (Array.isArray(records) && records.length > 0) {
        return records.map((r: any) => ({
          userId: String(r.UserID || r.userId || r.CardNo || ''),
          nombre: String(r.CardName || r.UserName || r.name || r.Name || ''),
          codigoTarjeta: r.CardNo || r.cardNo || undefined,
          habilitado: r.CardStatus === 0 || r.Enable !== false || r.IsValid === true || r.IsValid === 'true',
          recno: r.RecNo !== undefined ? Number(r.RecNo) : undefined,
          raw: r,
        }));
      }
    } catch { /* no es JSON */ }

    // 2. Parsear formato records[i].Key=Value y table.AccessControlCard[i].Key=Value
    const lines = rawStr.split(/[\r\n]+/);
    for (const line of lines) {
      const match = line.match(/(?:records|table\.[^\[]+)\[(\d+)\]\.([^=]+)=(.*)/);
      if (match) {
        const idx = parseInt(match[1], 10);
        const key = match[2].trim();
        const val = match[3].trim();
        if (!personasMap.has(idx)) {
          personasMap.set(idx, {});
        }
        personasMap.get(idx)[key] = val;
      }
    }

    const personas: DahuaPersona[] = [];
    for (const [, obj] of personasMap.entries()) {
      const userId = obj['UserID'] || obj['CardNo'] || '';
      if (userId) {
        personas.push({
          userId: String(userId),
          nombre: obj['CardName'] || obj['UserName'] || `Usuario ${userId}`,
          codigoTarjeta: obj['CardNo'] || undefined,
          habilitado: obj['CardStatus'] === '0' || obj['IsValid'] === 'true' || obj['Enable'] !== 'false',
          recno: obj['RecNo'] ? parseInt(obj['RecNo'], 10) : undefined,
          raw: obj,
        });
      }
    }

    return personas;
  }

  /**
   * Parsea los eventos del log de acceso Dahua.
   */
  private parseDahuaEventos(raw: string): DahuaEvento[] {
    const eventos: DahuaEvento[] = [];

    try {
      const json = JSON.parse(raw);
      const records = json?.records || json?.data || json?.params?.records || [];
      if (Array.isArray(records)) {
        return records.map((r: any) => ({
          tipo: this.mapDahuaEventType(r.EventType || r.type || r.Status || ''),
          userId: r.UserID || r.userId || undefined,
          nombre: r.CardName || r.UserName || r.name || undefined,
          codigoTarjeta: r.CardNo || r.cardNo || undefined,
          timestamp: r.Time || r.time || new Date().toISOString(),
          canal: Number(r.Door || r.Channel || r.channel || 1),
          raw: r,
        }));
      }
    } catch { /* parsear como table.XXX */ }

    const map = new Map<string, any>();
    const lines = raw.split('\n');
    for (const line of lines) {
      const match = line.trim().match(/^table\.([a-zA-Z0-9_]+)\[(\d+)\]\.([a-zA-Z0-9_]+)=(.*)$/);
      if (!match) continue;
      const [, tableName, index, key, val] = match;
      const itemKey = `${tableName}_${index}`;
      if (!map.has(itemKey)) map.set(itemKey, {});
      map.get(itemKey)[key] = val;
    }

    for (const [, obj] of map.entries()) {
      if (obj.UserID || obj.CardNo || obj.Time || obj.CardName || obj.UserName) {
        eventos.push({
          tipo: this.mapDahuaEventType(obj.EventType || obj.Status || obj.Method || ''),
          userId: obj.UserID || undefined,
          nombre: obj.CardName || obj.UserName || undefined,
          codigoTarjeta: obj.CardNo || undefined,
          timestamp: obj.Time || new Date().toISOString(),
          canal: Number(obj.Door || obj.Channel || 1),
          raw: obj,
        });
      }
    }

    return eventos;
  }

  /**
   * Mapea el EventType del Dahua al tipo de evento normalizado de PROLISEG.
   */
  private mapDahuaEventType(eventType: string | number): string {
    const et = String(eventType).toLowerCase();
    if (et.includes('entry') || et.includes('enter') || et === '1' || et === 'true') return 'entrada';
    if (et.includes('exit')) return 'salida';
    if (et.includes('failed') || et.includes('deny') || et === '0' || et === 'false') return 'acceso_denegado';
    if (et.includes('call') || et.includes('videotalk')) return 'llamada';
    if (et.includes('open')) return 'puerta_abierta';
    if (et.includes('close')) return 'puerta_cerrada';
    return 'entrada';
  }

  /**
   * Transmite audio bidireccional directamente al altavoz del hardware Dahua usando NetSDK TCP (puerto 37777 / 20006).
   */
  async relayAudioNetSDK(
    audioStream: NodeJS.ReadableStream,
    ip: string,
    port: number,
    user: string,
    pass: string,
  ): Promise<boolean> {
    try {
      const sdkPort = port >= 10000 ? (20000 + (port % 10000)) : 37777;
      this.logger.log(`🎙️ [DAHUA-NETSDK-TALK] Iniciando audio bidireccional por NetSDK TCP ${ip}:${sdkPort}...`);

      const koffi = require('koffi');
      const fs = require('fs');
      const path = require('path');

      const possibleDllPaths = [
        path.join(process.cwd(), 'libs', 'linux-x64', 'libdhnetsdk.so'),
        path.join(process.cwd(), 'libs', 'libdhnetsdk.so'),
        '/usr/lib/libdhnetsdk.so',
        '/usr/local/lib/libdhnetsdk.so',
        'C:\\Program Files\\SmartPSSLite\\dhnetsdk.dll',
        'C:\\Program Files (x86)\\SmartPSS\\dhnetsdk.dll',
        path.join(process.cwd(), 'libs', 'dhnetsdk.dll'),
      ];

      const dllPath = possibleDllPaths.find(p => fs.existsSync(p));

      const userClean = user || 'admin';
      const passClean = pass || 'proliseg123';

      this.logger.log(`🎙️ [DAHUA-NETSDK-TALK] Usando librería: ${dllPath}`);

      // Pre-cargar librerías auxiliares en Linux para resolución de símbolos
      try {
        const libDir = path.dirname(dllPath);
        const dvrPath = path.join(libDir, 'libdhdvr.so');
        const cfgPath = path.join(libDir, 'libdhconfigsdk.so');
        if (fs.existsSync(dvrPath)) { try { koffi.load(dvrPath); } catch {} }
        if (fs.existsSync(cfgPath)) { try { koffi.load(cfgPath); } catch {} }
      } catch {}

      const lib = koffi.load(dllPath);

      const NET_DEVICEINFO_Simple = koffi.struct('NET_DEVICEINFO_NetTalk', {
        sSerialNumber: koffi.array('char', 48),
        byAlarmInPortNum: 'uint8_t',
        byAlarmOutPortNum: 'uint8_t',
        byDiskNum: 'uint8_t',
        byDVRType: 'uint8_t',
        byChanNum: 'uint8_t',
      });

      const isWin = process.platform === 'win32';
      const callConv = isWin && process.arch === 'ia32' ? '__stdcall ' : '';

      const CLIENT_Init = lib.func(`bool ${callConv}CLIENT_Init(void* fDisConnect, int64_t dwUser)`);
      const CLIENT_Cleanup = lib.func(`void ${callConv}CLIENT_Cleanup()`);
      const CLIENT_Login = lib.func(`int64_t ${callConv}CLIENT_Login(str pchDVRIP, uint16_t wDVRPort, str pchUserName, str pchPassword, void* lpDeviceInfo, _Out_ int* error)`);
      const CLIENT_Logout = lib.func(`bool ${callConv}CLIENT_Logout(int64_t lLoginID)`);
      const CLIENT_StartTalkEx = lib.func(`int64_t ${callConv}CLIENT_StartTalkEx(int64_t lLoginID, void *pfcb, int64_t dwUser)`);
      const CLIENT_StopTalkEx = lib.func(`bool ${callConv}CLIENT_StopTalkEx(int64_t lTalkHandle)`);
      const CLIENT_TalkSendData = lib.func(`int32_t ${callConv}CLIENT_TalkSendData(int64_t lTalkHandle, uint8_t *pDataBuf, uint32_t dwBufSize)`);
      const CLIENT_SetVolume = lib.func(`bool ${callConv}CLIENT_SetVolume(int64_t lTalkHandle, int nVolume)`);

      CLIENT_Init(null, 0);

      const devInfo = Buffer.alloc(1024);
      const errPtr = [0];
      const loginId = CLIENT_Login(ip, sdkPort, userClean, passClean, devInfo, errPtr);

      if (!loginId || loginId === 0n || loginId === 0) {
        this.logger.warn(`⚠️ [DAHUA-NETSDK-TALK] Login falló en ${ip}:${sdkPort} (Error ${errPtr[0]}) con usuario ${userClean}`);
        CLIENT_Cleanup();
        return false;
      }

      this.logger.log(`✅ [DAHUA-NETSDK-TALK] Login exitoso (ID: ${loginId}). Iniciando TalkEx...`);

      const talkHandle = CLIENT_StartTalkEx(loginId, null, 0);
      if (!talkHandle || talkHandle === 0n || talkHandle === 0) {
        this.logger.warn(`⚠️ [DAHUA-NETSDK-TALK] CLIENT_StartTalkEx falló`);
        CLIENT_Logout(loginId);
        CLIENT_Cleanup();
        return false;
      }

      try {
        CLIENT_SetVolume(talkHandle, 100);
      } catch {}

      this.logger.log(`🎉 [DAHUA-NETSDK-TALK] Altavoz abierto en hardware Dahua (Handle: ${talkHandle})`);

      const ffmpegPath = require('ffmpeg-static');
      const { spawn } = require('child_process');

      const ffmpeg = spawn(ffmpegPath, [
        '-hide_banner',
        '-loglevel', 'warning',
        '-fflags', 'nobuffer',
        '-flags', 'low_delay',
        '-probesize', '4096',
        '-f', 'webm',
        '-i', 'pipe:0',
        '-ac', '1',
        '-ar', '8000',
        '-c:a', 'pcm_alaw',
        '-af', 'volume=3.5',
        '-f', 'alaw',
        '-flush_packets', '1',
        'pipe:1',
      ]);

      ffmpeg.stdout.on('data', (chunk: Buffer) => {
        try {
          CLIENT_TalkSendData(talkHandle, chunk, chunk.length);
        } catch {}
      });

      return new Promise<boolean>((resolve) => {
        let isDone = false;
        const cleanUp = () => {
          if (isDone) return;
          isDone = true;
          try { ffmpeg.kill('SIGKILL'); } catch {}
          try { CLIENT_StopTalkEx(talkHandle); } catch {}
          try { CLIENT_Logout(loginId); } catch {}
          try { CLIENT_Cleanup(); } catch {}
          this.logger.log(`✅ [DAHUA-NETSDK-TALK] Sesión de audio finalizada`);
          resolve(true);
        };

        audioStream.on('close', cleanUp);
        (audioStream as any).on('end', cleanUp);
        audioStream.on('error', cleanUp);
        ffmpeg.on('close', cleanUp);
        ffmpeg.on('error', cleanUp);

        audioStream.pipe(ffmpeg.stdin);
      });
    } catch (e: any) {
      this.logger.error(`❌ [DAHUA-NETSDK-TALK] Error: ${e.message}`);
      return false;
    }
  }
}
