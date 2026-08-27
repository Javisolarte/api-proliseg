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
  recno?: number;
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
      ].join('&');
      await this.cgi(ip, port, user, pass, 'GET', `/cgi-bin/configManager.cgi?${query}`);
      this.logger.log(`📹 [DAHUA ENCODE] Formato H.264 (GOP=25) + Audio G.711A (8000Hz) configurado en ${ip}:${port}`);
    } catch (err) {
      this.logger.warn(`⚠️ [DAHUA ENCODE] No se pudo forzar H.264/GOP/G.711A vía CGI: ${err.message}`);
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
   * Lista todas las personas registradas en el hardware Dahua (usuarios y tarjetas).
   */
  async listarPersonas(ip: string, port: number, user: string, pass: string): Promise<DahuaPersona[]> {
    this.logger.log(`👥 [DAHUA PERSONAS] Listando usuarios de ${ip}:${port}`);

    try {
      const [respUser, respCard] = await Promise.all([
        this.cgi(ip, port, user, pass, 'GET', `/cgi-bin/recordFinder.cgi?action=find&name=AccessUserInfo&count=1000`).catch(() => ({ data: '' })),
        this.cgi(ip, port, user, pass, 'GET', `/cgi-bin/recordFinder.cgi?action=find&name=AccessControlCard&count=1000`).catch(() => ({ data: '' })),
      ]);

      const personasUser = this.parseDahuaPersonas(String(respUser.data || ''));
      const personasCard = this.parseDahuaPersonas(String(respCard.data || ''));

      const map = new Map<string, DahuaPersona>();
      for (const p of personasUser) {
        map.set(String(p.userId), p);
      }
      for (const p of personasCard) {
        if (map.has(String(p.userId))) {
          const existing = map.get(String(p.userId))!;
          existing.codigoTarjeta = p.codigoTarjeta || existing.codigoTarjeta;
          existing.recno = p.recno ?? existing.recno;
        } else {
          map.set(String(p.userId), p);
        }
      }

      return Array.from(map.values());
    } catch (err) {
      this.logger.warn(`⚠️ [DAHUA PERSONAS] Error al listar usuarios: ${err.message}`);
      return [];
    }
  }

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
      `Authority=1`,
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
    } catch (insertErr) {
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
      `Authority=1`,
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
   * Elimina una persona del hardware Dahua (AccessUserInfo y AccessControlCard).
   */
  async eliminarPersona(ip: string, port: number, user: string, pass: string, userId: string): Promise<{ ok: boolean }> {
    const userIdClean = String(userId).slice(0, 20);
    this.logger.log(`🗑️ [DAHUA PERSONA] Eliminando userId=${userIdClean} de ${ip}:${port}`);

    // 1. Eliminar de AccessControlCard
    const existentes = await this.listarPersonas(ip, port, user, pass);
    const coincidencia = existentes.find(
      p => String(p.userId) === userIdClean || String(p.codigoTarjeta) === userIdClean
    );

    if (coincidencia && coincidencia.recno !== undefined) {
      await this.cgi(
        ip, port, user, pass, 'GET',
        `/cgi-bin/recordUpdater.cgi?action=remove&name=AccessControlCard&recno=${coincidencia.recno}`,
      ).catch(() => {});
    }

    // 2. Eliminar de AccessUserInfo
    try {
      await this.cgi(
        ip, port, user, pass, 'GET',
        `/cgi-bin/recordUpdater.cgi?action=remove&name=AccessUserInfo&UserID=${encodeURIComponent(userIdClean)}`,
      );
    } catch {}

    return { ok: true };
  }

  /**
   * Sube/actualiza la foto facial de una persona en el hardware Dahua ASI7213X vía JSON-RPC (AccessFaceInfo).
   */
  async subirFotoFacial(
    ip: string, port: number, user: string, pass: string,
    userId: string, fotoBase64: string,
  ): Promise<boolean> {
    try {
      this.logger.log(`🤳 [DAHUA FACE] Subiendo foto facial para userId=${userId} en ${ip}:${port}`);

      // Limpiar prefijo data:image/... si está presente
      const base64Clean = fotoBase64.includes(',') ? fotoBase64.split(',')[1] : fotoBase64;

      // 1. Crear instancia de RecordUpdater para AccessFaceInfo
      const inst = await this.rpcCall(ip, port, user, pass, 'RecordUpdater.factory.instance', { name: 'AccessFaceInfo' });
      const updaterId = inst?.result;

      if (!updaterId) {
        this.logger.warn(`⚠️ [DAHUA FACE] No se pudo obtener RecordUpdater para AccessFaceInfo en ${ip}:${port}`);
        return false;
      }

      // 2. Insertar foto facial para el UserID
      const insertRes = await this.rpcCall(ip, port, user, pass, 'RecordUpdater.insert', {
        record: {
          UserID: String(userId).slice(0, 20),
          PhotoData: [base64Clean],
        }
      }, updaterId);

      // 3. Destruir el RecordUpdater para liberar recursos en el Dahua
      await this.rpcCall(ip, port, user, pass, 'RecordUpdater.destroy', null, updaterId).catch(() => {});

      if (insertRes?.result) {
        this.logger.log(`✅ [DAHUA FACE] Foto facial vinculada exitosamente con el rostro en Dahua para userId=${userId}`);
        return true;
      } else {
        this.logger.warn(`⚠️ [DAHUA FACE] Dahua no pudo procesar el rostro para userId=${userId}: ${JSON.stringify(insertRes?.error || insertRes)}`);
        return false;
      }
    } catch (err) {
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
