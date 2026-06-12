import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import axios from 'axios';
import { createHash, randomBytes } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';

// ─── Tipos públicos ────────────────────────────────────────────────────────

export interface EventoAcceso {
  dispositivo_id: string;
  nombre_dispositivo: string;
  tipo_evento: string;       // 'entrada' | 'salida' | 'puerta_abierta' | 'puerta_cerrada' | 'alarma' | 'cmd_usuario'
  metodo_acceso?: string;    // 'facial' | 'tarjeta' | 'pin' | 'remoto' | 'boton'
  persona_id?: string;
  documento_persona?: string;
  codigo_tarjeta?: string;
  face_id_ref?: string;
  nombre_persona?: string;
  foto_evidencia_url?: string;
  timestamp: string;         // ISO
  detalles_raw?: any;
}

export type EmitEventoFn = (evento: EventoAcceso) => void;

interface DeviceInfo {
  id: string;
  nombre_identificador: string;
  ip_direccion: string;
  credencial_usuario: string;
  credencial_password: string;
  configuracion_tecnica: any;
}

// ─── Servicio ─────────────────────────────────────────────────────────────

@Injectable()
export class DevicePollerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DevicePollerService.name);

  /** Función de emisión WebSocket — inyectada desde el Gateway */
  private emitFn: EmitEventoFn | null = null;

  private controlPuertaFn: ((ip: string, doorId: number, command: 'abrir' | 'cerrar' | 'siempre-abierta' | 'siempre-cerrada', options: any) => Promise<any>) | null = null;

  setControlPuertaFn(fn: (ip: string, doorId: number, command: 'abrir' | 'cerrar' | 'siempre-abierta' | 'siempre-cerrada', options: any) => Promise<any>) {
    this.controlPuertaFn = fn;
  }

  /** IDs ya procesados para deduplicar — en memoria, bajo consumo */
  private readonly seenEventIds = new Set<string>();
  private readonly latestDbTimestamp = new Map<string, string>();

  /** Cache in-memoria para evitar consultas repetitivas de dispositivos */
  private readonly devicesMap = new Map<string, DeviceInfo>();

  private markAsSeen(eventId: string) {
    this.seenEventIds.add(eventId);
    if (this.seenEventIds.size > 5000) {
      const iterator = this.seenEventIds.values();
      for (let i = 0; i < 2000; i++) {
        const val = iterator.next().value;
        if (val !== undefined) {
          this.seenEventIds.delete(val);
        } else {
          break;
        }
      }
    }
  }

  /**
   * FALLBACK: polling para dispositivos que NO soporten webhook push.
   * Solo arranca si el dispositivo tiene configuracion_tecnica.push_disabled = true
   */
  private readonly fallbackTimers = new Map<string, NodeJS.Timeout>();
  private readonly FALLBACK_POLL_MS = 30_000; // 30s solo para los que no tienen push

  constructor(private readonly supabase: SupabaseService) {}

  // ─── Ciclo de vida ────────────────────────────────────────────────────────

  async onModuleInit() {
    this.logger.log('📡 [EventSystem] Sistema de eventos iniciado.');
    // Registrar URLs de webhook en las cámaras + iniciar fallback polling
    setTimeout(() => this.setupAllDevices(), 6_000);
  }

  onModuleDestroy() {
    this.fallbackTimers.forEach(t => clearInterval(t));
    this.fallbackTimers.clear();
  }

  // ─── API Pública ──────────────────────────────────────────────────────────

  /** Llamado desde ComunicacionesGateway para inyectar el canal WebSocket */
  setEmitFn(fn: EmitEventoFn) {
    this.emitFn = fn;
    this.logger.log('📡 [EventSystem] Canal WebSocket conectado.');
  }

  /**
   * PUNTO PRINCIPAL: Procesa un evento llegado por webhook (push de la cámara).
   * Llamado desde el Controller cuando la cámara hace POST a /webhook/evento
   */
  async procesarWebhookHikvision(payload: any, dispositivoId?: string) {
    try {
      const info = payload?.AccessControllerEvent || payload?.EventNotificationAlert || payload;
      const device = await this.getDeviceById(dispositivoId || info?.ipAddress);
      if (!device) {
        this.logger.warn(`⚠️ [Webhook] Evento de dispositivo desconocido: ${dispositivoId}`);
        return { ok: false };
      }

      const eventId = this.getEventId(device.id, info);
      if (this.seenEventIds.has(eventId)) return { ok: true, duplicado: true };
      this.markAsSeen(eventId);

      const evento = this.buildEventoAcceso(device, info, this.sanitizeTimestamp(info?.dateTime));

      // Guardar y emitir — siempre sin await para no bloquear la respuesta HTTP a la cámara
      this.saveAndEmit(evento);
      this.logger.log(`🚪 [Webhook HIK] ${evento.tipo_evento} — ${evento.nombre_persona || 'Desconocido'} @ ${device.nombre_identificador}`);
      return { ok: true };
    } catch (err) {
      this.logger.error(`❌ [Webhook HIK] ${err.message}`);
      return { ok: false };
    }
  }

  async procesarWebhookDahua(payload: any, dispositivoId?: string) {
    try {
      const device = await this.getDeviceById(dispositivoId || '');
      if (!device) return { ok: false };

      const eventId = `dah_push_${device.id}_${payload?.LocaleTime || Date.now()}`;
      if (this.seenEventIds.has(eventId)) return { ok: true, duplicado: true };
      this.markAsSeen(eventId);

      const eventName = String(payload?.EventName || payload?.event || '').toLowerCase();
      const isCall = eventName.includes('videotalk') || eventName.includes('call') || eventName.includes('bell') || eventName.includes('timbre');

      const evento: EventoAcceso = {
        dispositivo_id: device.id,
        nombre_dispositivo: device.nombre_identificador,
        tipo_evento: isCall ? 'llamada' : (payload?.Action === 'Start' ? 'entrada' : 'salida'),
        metodo_acceso: 'tarjeta',
        nombre_persona: this.firstText(payload?.Name, payload?.UserName, payload?.User),
        documento_persona: this.firstText(payload?.UserID, payload?.UserId, payload?.UserNo, payload?.EmployeeNo),
        codigo_tarjeta: this.firstText(payload?.CardNo, payload?.CardNumber),
        face_id_ref: this.firstText(payload?.FaceID, payload?.FaceId),
        foto_evidencia_url: this.firstText(payload?.PictureURL, payload?.PhotoURL, payload?.FaceURL),
        timestamp: payload?.LocaleTime || new Date().toISOString(),
        detalles_raw: payload,
      };

      this.saveAndEmit(evento);
      this.logger.log(`🚪 [Webhook DH] ${evento.tipo_evento} — ${evento.nombre_persona || 'Desconocido'} @ ${device.nombre_identificador}`);
      return { ok: true };
    } catch (err) {
      this.logger.error(`❌ [Webhook DH] ${err.message}`);
      return { ok: false };
    }
  }

  /** Guarda un evento generado por un comando manual (abrir/cerrar puerta) */
  async guardarEventoManual(evento: EventoAcceso) {
    this.saveAndEmit(evento);
  }

  /** Refresca la lista de dispositivos tras crear/eliminar uno */
  async refreshDeviceList() {
    this.fallbackTimers.forEach(t => clearInterval(t));
    this.fallbackTimers.clear();
    this.devicesMap.clear();
    await this.setupAllDevices();
  }

  // ─── Setup inicial: registro de webhooks en cámaras ──────────────────────

  private async setupAllDevices() {
    const { data: devices } = await this.supabase
      .getClient()
      .from('dispositivos_iot')
      .select('id, nombre_identificador, ip_direccion, credencial_usuario, credencial_password, configuracion_tecnica')
      .in('estado', ['operativo', 'mantenimiento']);

    this.devicesMap.clear();
    if (!devices?.length) return;

    for (const device of devices as DeviceInfo[]) {
      this.devicesMap.set(device.id, device);
      if (device.ip_direccion) {
        this.devicesMap.set(device.ip_direccion, device);
      }
    }

    // URL pública donde las cámaras deben mandar sus eventos
    const webhookBase = 'http://servidor.proliseg.com/api/control-acceso/webhook/evento';

    for (const device of devices as DeviceInfo[]) {
      const marca = (device.configuracion_tecnica?.marca || 'hikvision').toLowerCase();
      const port = device.configuracion_tecnica?.puertos_mapeados?.mapped_http
        || device.configuracion_tecnica?.puerto
        || 80;
      const user = device.credencial_usuario || 'admin';
      const pass = device.credencial_password || '';
      const ip = device.ip_direccion;

      // Sincronizar hora del biométrico al iniciar/refrescar
      await this.syncDeviceTime(device).catch(() => {});

      if (marca.includes('hikvision') || marca.includes('hik')) {
        // Intentar registrar el webhook en Hikvision
        await this.registerHikvisionWebhook(device, ip, port, user, pass, webhookBase).catch((err) => {
          this.logger.warn(`⚠️ [EventSystem] Error al registrar webhook en ${device.nombre_identificador}: ${err.message}`);
        });
        // Siempre iniciar polling como respaldo de seguridad
        this.startFallbackPolling(device, ip, port, user, pass, marca);
      } else if (marca.includes('dahua')) {
        await this.registerDahuaWebhook(device, ip, port, user, pass, webhookBase).catch((err) => {
          this.logger.warn(`⚠️ [EventSystem] Error al registrar webhook en ${device.nombre_identificador}: ${err.message}`);
        });
        this.startFallbackPolling(device, ip, port, user, pass, marca);
      } else {
        // Genérico: intentar Hikvision, si falla usar fallback
        await this.registerHikvisionWebhook(device, ip, port, user, pass, webhookBase).catch(() => {});
        this.startFallbackPolling(device, ip, port, user, pass, 'hikvision');
      }
    }
  }

  // ─── Registro de webhook en Hikvision ISAPI ───────────────────────────────

  private async registerHikvisionWebhook(
    device: DeviceInfo, ip: string, port: number, user: string, pass: string, webhookBase: string
  ) {
    const base = `http://${ip}:${port}`;
    const auth = { username: user, password: pass };
    
    const isVpn = this.isVpnIp(device.ip_direccion || ip);
    
    let ipAddressVal = '10.8.0.1';
    let portNoVal = 80;
    let protocolVal = 'HTTP';
    let addressingTypeVal = 'ipaddress';
    let webhookUrl = `http://10.8.0.1/api/control-acceso/webhook/evento/hik/${device.id}`;
    
    if (!isVpn) {
      ipAddressVal = 'servidor.proliseg.com';
      portNoVal = 443;
      protocolVal = 'HTTPS';
      addressingTypeVal = 'hostname';
      const secureWebhookBase = webhookBase.replace(/^http:/i, 'https:');
      webhookUrl = `${secureWebhookBase}/hik/${device.id}`;
    }

    // Permitir personalizar el webhook desde configuracion_tecnica si es necesario
    const customWebhookBase = device.configuracion_tecnica?.webhook_base;
    if (customWebhookBase) {
      try {
        const urlObj = new URL(customWebhookBase);
        protocolVal = urlObj.protocol.replace(':', '').toUpperCase();
        ipAddressVal = urlObj.hostname;
        portNoVal = urlObj.port ? parseInt(urlObj.port, 10) : (protocolVal === 'HTTPS' ? 443 : 80);
        addressingTypeVal = /^[0-9.]+$/.test(ipAddressVal) ? 'ipaddress' : 'hostname';
        webhookUrl = `${customWebhookBase}/hik/${device.id}`;
        this.logger.log(`⚙️ [EventSystem] Usando webhook_base personalizado para Hikvision (${device.nombre_identificador}): ${webhookUrl}`);
      } catch (e) {
        this.logger.warn(`⚠️ [EventSystem] Error al procesar webhook_base personalizado "${customWebhookBase}": ${e.message}`);
      }
    }

    const payload = `<?xml version="1.0" encoding="UTF-8"?>
<HttpHostNotificationList>
  <HttpHostNotification version="2.0">
    <id>1</id>
    <url>${webhookUrl}</url>
    <protocolType>${protocolVal}</protocolType>
    <parameterFormatType>JSON</parameterFormatType>
    <addressingFormatType>${addressingTypeVal}</addressingFormatType>
    <hostName>${ipAddressVal}</hostName>
    <ipAddress>${ipAddressVal}</ipAddress>
    <portNo>${portNoVal}</portNo>
    <httpAuthenticationMethod>none</httpAuthenticationMethod>
  </HttpHostNotification>
</HttpHostNotificationList>`;

    await this.executeDigestRequest(
      'PUT',
      `${base}/ISAPI/Event/notification/httpHosts/1`,
      user,
      pass,
      payload,
      'application/xml',
      5000
    );

    this.logger.log(`✅ [EventSystem] Webhook Hikvision registrado → ${device.nombre_identificador} via ${protocolVal} (${ipAddressVal}:${portNoVal})`);
  }

  // ─── Registro de webhook en Dahua CGI ─────────────────────────────────────

  private async registerDahuaWebhook(
    device: DeviceInfo, ip: string, port: number, user: string, pass: string, webhookBase: string
  ) {
    const base = `http://${ip}:${port}`;
    const auth = { username: user, password: pass };
    
    const isVpn = this.isVpnIp(device.ip_direccion || ip);
    let webhookUrl = isVpn
      ? `http://10.8.0.1/api/control-acceso/webhook/evento/dahua/${device.id}`
      : `${webhookBase.replace(/^http:/i, 'https:')}/dahua/${device.id}`;

    // Permitir personalizar el webhook desde configuracion_tecnica
    const customWebhookBase = device.configuracion_tecnica?.webhook_base;
    if (customWebhookBase) {
      webhookUrl = `${customWebhookBase}/dahua/${device.id}`;
      this.logger.log(`⚙️ [EventSystem] Usando webhook_base personalizado para Dahua (${device.nombre_identificador}): ${webhookUrl}`);
    }

    let protocol = 'HTTP';
    if (webhookUrl.startsWith('https://')) {
      protocol = 'HTTPS';
    }

    await this.executeDigestRequest(
      'GET',
      `${base}/cgi-bin/configManager.cgi?action=setConfig&VSP_IPAddress[0].Enable=true&VSP_IPAddress[0].Address=${encodeURIComponent(webhookUrl)}&VSP_IPAddress[0].Protocol=${protocol}`,
      user,
      pass,
      null,
      'application/x-www-form-urlencoded',
      5000
    );

    this.logger.log(`✅ [EventSystem] Webhook Dahua registrado → ${device.nombre_identificador} via ${protocol}`);
  }

  // ─── Fallback Polling (solo si no soporta webhook) ────────────────────────

  private startFallbackPolling(device: DeviceInfo, ip: string, port: number, user: string, pass: string, marca: string) {
    if (this.fallbackTimers.has(device.id)) return;
    this.logger.warn(`⚠️ [EventSystem] ${device.nombre_identificador} no soporta webhook → fallback polling ${this.FALLBACK_POLL_MS / 1000}s`);

    const timer = setInterval(() => {
      this.fallbackPoll(device, ip, port, user, pass, marca).catch(() => {});
    }, this.FALLBACK_POLL_MS);

    this.fallbackTimers.set(device.id, timer);
  }

  private async fallbackPoll(device: DeviceInfo, ip: string, port: number, user: string, pass: string, marca: string) {
    try {
      if (!this.latestDbTimestamp.has(device.id)) {
        const { data } = await this.supabase
          .getClient()
          .from('dispositivos_eventos_historico')
          .select('timestamp')
          .eq('dispositivo_id', device.id)
          .order('timestamp', { ascending: false })
          .limit(1);
        
        const lastTimestamp = data?.[0]?.timestamp || new Date(0).toISOString();
        this.latestDbTimestamp.set(device.id, lastTimestamp);
      }

      const base = `http://${ip}:${port}`;

      const resp = await this.executeDigestRequest(
        'POST',
        `${base}/ISAPI/AccessControl/AcsEvent?format=json`,
        user,
        pass,
        { 
          AcsEventCond: { 
            searchID: `fb_${device.id}_${Date.now()}`, 
            searchResultPosition: 0, 
            maxResults: 20, 
            major: 0, 
            minor: 0 
          } 
        },
        'application/json',
        5000,
        'json'
      );

      let responseData = resp.data;
      if (typeof responseData === 'string') {
        try {
          responseData = JSON.parse(responseData);
        } catch (e) {
          this.logger.warn(`⚠️ [EventSystem] Error al parsear JSON de eventos fallback: ${e.message}`);
        }
      }

      const infos = responseData?.AcsEvent?.InfoList || [];
      const lastDbTimeStr = this.latestDbTimestamp.get(device.id) || new Date(0).toISOString();
      const lastDbTime = new Date(lastDbTimeStr).getTime();

      for (const info of infos) {
        let eventTimeStr = info.time || new Date().toISOString();
        try {
          const dt = new Date(eventTimeStr);
          if (isNaN(dt.getTime()) || dt.getFullYear() < 2025) {
            // Si la fecha es inválida o en 1970 (reloj desconfigurado), le asignamos la hora actual
            // con un desfase incremental en segundos basado en el índice para mantener orden cronológico y evitar exclusión por timestamp
            const now = new Date();
            now.setSeconds(now.getSeconds() - (infos.length - infos.indexOf(info)));
            eventTimeStr = now.toISOString();
          }
        } catch {
          eventTimeStr = new Date().toISOString();
        }

        const eventTime = new Date(eventTimeStr).getTime();
        if (eventTime <= lastDbTime) continue;

        const eventId = this.getEventId(device.id, info);
        if (this.seenEventIds.has(eventId)) continue;
        this.markAsSeen(eventId);

        if (eventTime > new Date(this.latestDbTimestamp.get(device.id) || 0).getTime()) {
          this.latestDbTimestamp.set(device.id, eventTimeStr);
        }

        const evento = this.buildEventoAcceso(device, info, eventTimeStr);
        this.saveAndEmit(evento);
      }
    } catch (err) { /* offline — silencioso */ }
  }

  private buildDigestHeader(method: string, url: string, user: string, pass: string, challenge: any) {
    const { realm, nonce, qop } = challenge;
    const nc = '00000001';
    const cnonce = randomBytes(4).toString('hex');
    const uri = new URL(url).pathname + (new URL(url).search || '');

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
    return authStr;
  }

  private async executeDigestRequest(
    method: string,
    url: string,
    user: string,
    pass: string,
    body: any = null,
    contentType: string = 'application/xml',
    timeout: number = 5000,
    responseType: any = 'text'
  ): Promise<any> {
    try {
      return await axios.request({
        method,
        url,
        data: body,
        headers: { 'Content-Type': contentType },
        timeout,
        responseType
      });
    } catch (err) {
      if (err.response && err.response.status === 401) {
        const authHeader = err.response.headers['www-authenticate'];
        if (!authHeader) throw err;
        
        const realm = authHeader.match(/realm="([^"]+)"/)?.[1];
        const nonce = authHeader.match(/nonce="([^"]+)"/)?.[1];
        const qop = authHeader.match(/qop="([^"]+)"/)?.[1];
        
        const challenge = { realm, nonce, qop };
        const header = this.buildDigestHeader(method, url, user, pass, challenge);
        
        return await axios.request({
          method,
          url,
          data: body,
          headers: {
            Authorization: header,
            'Content-Type': contentType,
            'Accept': 'application/xml'
          },
          timeout,
          responseType
        });
      }
      throw err;
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async getDeviceById(idOrIp: string): Promise<DeviceInfo | null> {
    if (!idOrIp) return null;
    const cached = this.devicesMap.get(idOrIp);
    if (cached) return cached;

    const { data } = await this.supabase.getClient()
      .from('dispositivos_iot')
      .select('id, nombre_identificador, ip_direccion, credencial_usuario, credencial_password, configuracion_tecnica')
      .or(`id.eq.${idOrIp},ip_direccion.eq.${idOrIp}`)
      .maybeSingle();

    if (data) {
      const dev = data as DeviceInfo;
      this.devicesMap.set(dev.id, dev);
      if (dev.ip_direccion) {
        this.devicesMap.set(dev.ip_direccion, dev);
      }
      return dev;
    }
    return null;
  }

  private mapHikvisionEventType(major: number, minor: number, eventType?: string): string {
    const et = String(eventType || '').toLowerCase();
    
    // Si es AccessControl (major 5), manejamos detalladamente sus subestados
    if (major === 5) {
      if (minor === 75) return 'entrada';
      if (minor === 76) return 'salida';
      if (minor === 21) return 'apertura_boton'; // Botón físico de salida presionado
      if (minor === 22) return 'puerta_abierta'; // Evento de estado de puerta / botón liberado
      if (minor === 23) return 'puerta_cerrada';
      return 'acceso';
    }

    // Intercomunicador / Timbre (sólo si no es major 5)
    if (major === 3 || minor === 44 || minor === 9 || minor === 22 || 
        et.includes('call') || et.includes('ring') || et.includes('intercom') || et.includes('videotalk')) {
      return 'llamada';
    }
    if (major === 6) return 'alarma';
    if (major === 1 || eventType === 'doorOpen') return 'puerta_abierta';
    if (major === 2 || eventType === 'doorClose') return 'puerta_cerrada';
    return 'evento';
  }

  private mapHikvisionMethod(kind: number): string {
    return { 1: 'tarjeta', 2: 'pin', 3: 'tarjeta_pin', 4: 'facial', 7: 'facial_tarjeta', 8: 'boton' }[kind] || 'desconocido';
  }

  private buildEventoAcceso(device: DeviceInfo, info: any, timestampStr: string): EventoAcceso {
    const tipoEvento = this.mapHikvisionEventType(info?.major, info?.minor, info?.eventType);
    let metodoAcceso = this.mapHikvisionMethod(info?.cardReaderKind);
    let nombrePersona = this.firstText(info?.name, info?.employeeName, info?.userName, info?.UserName);
    let documentoPersona = this.firstText(info?.employeeNoString, info?.employeeNo, info?.userID, info?.UserID, info?.personId);

    if (tipoEvento === 'apertura_boton') {
      nombrePersona = 'Apertura por Botón';
      documentoPersona = 'BOTON';
      metodoAcceso = 'boton';
    } else if (tipoEvento === 'puerta_abierta') {
      nombrePersona = 'Puerta Abierta';
      documentoPersona = 'SENSOR';
      metodoAcceso = 'sensor';
    } else if (tipoEvento === 'puerta_cerrada') {
      nombrePersona = 'Puerta Cerrada';
      documentoPersona = 'SENSOR';
      metodoAcceso = 'sensor';
    }

    return {
      dispositivo_id: device.id,
      nombre_dispositivo: device.nombre_identificador,
      tipo_evento: tipoEvento,
      metodo_acceso: metodoAcceso,
      nombre_persona: nombrePersona,
      documento_persona: documentoPersona,
      codigo_tarjeta: this.firstText(info?.cardNo, info?.CardNo, info?.cardNumber),
      face_id_ref: this.firstText(info?.FPID, info?.faceID, info?.faceId),
      foto_evidencia_url: this.firstText(info?.pictureURL, info?.picUrl, info?.faceURL),
      timestamp: timestampStr,
      detalles_raw: info,
    };
  }

  // ─── Guardar en BD y Emitir por WebSocket (fire & forget) ─────────────────

  saveAndEmit(evento: EventoAcceso) {
    if (evento.timestamp) {
      const currentLatest = this.latestDbTimestamp.get(evento.dispositivo_id);
      if (!currentLatest || new Date(evento.timestamp).getTime() > new Date(currentLatest).getTime()) {
        this.latestDbTimestamp.set(evento.dispositivo_id, evento.timestamp);
      }
    }

    const persistirEvento = async () => {
      let persona: any = null;
      if (evento.tipo_evento === 'llamada') {
        evento.nombre_persona = 'Llamada a central/residente';
        evento.documento_persona = 'LLAMADA';
      } else {
        persona = await this.resolvePersonaForEvento(evento);
      }
      
      const payloadBase = {
        dispositivo_id: evento.dispositivo_id,
        persona_id: persona?.id || evento.persona_id || null,
        tipo_evento: evento.tipo_evento,
        metodo_acceso: evento.metodo_acceso || null,
        foto_evidencia_url: evento.foto_evidencia_url || null,
        timestamp: evento.timestamp || new Date().toISOString(),
      };

      const payloadExtendido = {
        ...payloadBase,
        nombre_persona: evento.nombre_persona || persona?.nombre_completo || null,
        documento_persona: evento.documento_persona || persona?.documento_identidad || null,
        detalles_raw: evento.detalles_raw || {},
      };

      const { error } = await this.supabase
        .getSupabaseAdminClient()
        .from('dispositivos_eventos_historico')
        .insert(payloadExtendido);

      if (!error) return;

      const missingExtendedColumn = /nombre_persona|documento_persona|detalles_raw/i.test(error.message || '');
      if (missingExtendedColumn) {
        const { error: fallbackError } = await this.supabase
          .getSupabaseAdminClient()
          .from('dispositivos_eventos_historico')
          .insert(payloadBase);
        if (fallbackError) this.logger.warn(`⚠️ [EventSystem] INSERT fallback: ${fallbackError.message}`);
        return;
      }

      this.logger.warn(`⚠️ [EventSystem] INSERT: ${error.message}`);
    };

    persistirEvento().catch((error) => {
      this.logger.warn(`⚠️ [EventSystem] No se pudo persistir evento: ${error.message}`);
    });

    this.checkQrAutoOpen(evento).catch((error) => {
      this.logger.error(`❌ [QR AUTO-OPEN ERROR]: ${error.message}`);
    });

    // Emitir por WebSocket - instantáneo
    if (this.emitFn) {
      try { this.emitFn(evento); } catch {}
    }
  }

  private async resolvePersonaForEvento(evento: EventoAcceso): Promise<any | null> {
    const documento = this.firstText(evento.documento_persona, evento.face_id_ref, evento.codigo_tarjeta);
    const nombre = this.firstText(evento.nombre_persona);
    const codigoTarjeta = this.firstText(evento.codigo_tarjeta);
    const faceId = this.firstText(evento.face_id_ref);

    if (!documento && !nombre && !codigoTarjeta && !faceId) return null;

    const admin = this.supabase.getSupabaseAdminClient();
    const existing = await this.findPersonaByIdentifiers(documento, codigoTarjeta, faceId);
    const nombreFinal = nombre || existing?.nombre_completo || 'Persona sin nombre';
    const documentoFinal = existing?.documento_identidad
      || documento
      || this.buildAutoDocumento(evento.dispositivo_id, nombreFinal);

    const payload: any = {
      nombre_completo: nombreFinal,
      documento_identidad: documentoFinal,
      entidad_tipo: existing?.entidad_tipo || 'otro',
      lista_estado: existing?.lista_estado || 'blanca',
      activo: true,
    };

    if (codigoTarjeta) payload.codigo_tarjeta = codigoTarjeta;
    if (faceId) payload.face_id_ref = faceId;

    if (existing?.id) {
      // FIX: solo actualizar campos de identificacion biometrica, NUNCA sobreescribir el nombre real
      const updatePayload: any = { activo: true };
      if (codigoTarjeta && codigoTarjeta !== existing.codigo_tarjeta) {
        updatePayload.codigo_tarjeta = codigoTarjeta;
      }
      if (faceId && faceId !== existing.face_id_ref) {
        updatePayload.face_id_ref = faceId;
      }
      // Solo actualizar si hay cambios reales en campos biometricos
      if (Object.keys(updatePayload).length > 1) {
        const { data, error } = await admin
          .from('personas_gestion_acceso')
          .update(updatePayload)
          .eq('id', existing.id)
          .select()
          .single();
        if (error) {
          this.logger.warn(`⚠️ [EventSystem] Persona no actualizada: ${error.message}`);
          return existing;
        }
        return data;
      }
      return existing;
    }

    // Si no existe, solo auto-crear si tiene credenciales reales y NO es una apertura manual
    const esAperturaManual = nombre && (nombre.toLowerCase().startsWith('abierto por') || nombre.toLowerCase().includes('abierto por'));
    const tieneCredenciales = !!(documento || codigoTarjeta || faceId);

    if (esAperturaManual || !tieneCredenciales) {
      return null;
    }

    const { data, error } = await admin
      .from('personas_gestion_acceso')
      .insert(payload)
      .select()
      .single();

    if (error) {
      this.logger.warn(`⚠️ [EventSystem] Persona no creada: ${error.message}`);
      return null;
    }

    await admin
      .from('acceso_permisos_dispositivos')
      .insert({ persona_id: data.id, dispositivo_id: evento.dispositivo_id, activo: true })
      .then(({ error: permisoError }) => {
        if (permisoError) this.logger.warn(`⚠️ [EventSystem] Permiso no creado: ${permisoError.message}`);
      });

    return data;
  }


  private async findPersonaByIdentifiers(documento?: string, codigoTarjeta?: string, faceId?: string): Promise<any | null> {
    const lookups = [
      documento ? `documento_identidad.eq.${documento}` : null,
      codigoTarjeta ? `codigo_tarjeta.eq.${codigoTarjeta}` : null,
      faceId ? `face_id_ref.eq.${faceId}` : null,
    ].filter(Boolean);

    if (lookups.length === 0) return null;

    const admin = this.supabase.getSupabaseAdminClient();
    const { data, error } = await admin
      .from('personas_gestion_acceso')
      .select('*')
      .or(lookups.join(','))
      .limit(1);

    if (!error && data && data.length > 0) return data[0];
    return null;
  }

  private firstText(...values: any[]): string | undefined {
    for (const value of values) {
      if (value === undefined || value === null) continue;
      const text = String(value).trim();
      if (text) return text;
    }
    return undefined;
  }

  private buildAutoDocumento(dispositivoId: string, nombre: string): string {
    const normalized = nombre
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toUpperCase()
      .slice(0, 32) || 'SIN-ID';
    return `AUTO-${dispositivoId.slice(0, 8)}-${normalized}`;
  }

  private isVpnIp(ip: string): boolean {
    return /^10\.8\./.test(ip);
  }

  private sanitizeTimestamp(timeStr: string): string {
    if (!timeStr) return new Date().toISOString();
    try {
      const dt = new Date(timeStr);
      if (isNaN(dt.getTime()) || dt.getFullYear() < 2025) {
        return new Date().toISOString();
      }
      return timeStr;
    } catch {
      return new Date().toISOString();
    }
  }

  private getEventId(deviceId: string, info: any): string {
    const uniqueVal = info?.serialNo || info?.time || info?.dateTime || info?.dateTimeString || 'rand_' + randomBytes(4).toString('hex');
    return `${deviceId}_${uniqueVal}`;
  }

  private async syncDeviceTime(device: DeviceInfo) {
    try {
      const ip = device.ip_direccion;
      const port = device.configuracion_tecnica?.puertos_mapeados?.mapped_http
        || device.configuracion_tecnica?.puerto
        || 80;
      const user = device.credencial_usuario || 'admin';
      const pass = device.credencial_password || '';

      // Obtener hora local de Colombia (UTC-5)
      const d = new Date();
      const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
      const colTime = new Date(utc - (3600000 * 5));
      
      const year = colTime.getFullYear();
      const month = String(colTime.getMonth() + 1).padStart(2, '0');
      const day = String(colTime.getDate()).padStart(2, '0');
      const hours = String(colTime.getHours()).padStart(2, '0');
      const minutes = String(colTime.getMinutes()).padStart(2, '0');
      const seconds = String(colTime.getSeconds()).padStart(2, '0');
      
      const timeStr = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}-05:00`;

      const payload = `<?xml version="1.0" encoding="UTF-8"?>
<Time version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
  <timeMode>manual</timeMode>
  <localTime>${timeStr}</localTime>
</Time>`;

      await this.executeDigestRequest(
        'PUT',
        `http://${ip}:${port}/ISAPI/System/time`,
        user,
        pass,
        payload,
        'application/xml',
        5000
      );
      this.logger.log(`⏰ [EventSystem] Hora sincronizada con éxito en ${device.nombre_identificador}: ${timeStr}`);
    } catch (err) {
      this.logger.warn(`⚠️ [EventSystem] No se pudo sincronizar la hora en ${device.nombre_identificador}: ${err.message}`);
    }
  }

  private async triggerDoorOpen(dispositivoId: string) {
    if (this.controlPuertaFn) {
      try {
        const device = await this.getDeviceById(dispositivoId);
        if (device?.ip_direccion) {
          await this.controlPuertaFn(device.ip_direccion, 1, 'abrir', {
            deviceId: device.id,
            marca: device.configuracion_tecnica?.marca,
          });
          this.logger.log(`🚪 [QR AUTO-OPEN] Puerta abierta automáticamente en dispositivo ${dispositivoId}`);
        }
      } catch (cmdErr) {
        this.logger.error(`❌ [QR AUTO-OPEN] Error al enviar comando de puerta: ${cmdErr.message}`);
      }
    } else {
      this.logger.warn(`⚠️ [QR AUTO-OPEN] controlPuertaFn no está registrado en el sistema`);
    }
  }

  private async checkQrAutoOpen(evento: EventoAcceso) {
    const rawScanned = this.firstText(evento.codigo_tarjeta, evento.documento_persona);
    if (!rawScanned) return;

    let scannedCode = rawScanned.trim();
    let token = scannedCode;

    // Si el QR escaneado es el JSON de la visita, extraemos el campo token
    if (scannedCode.startsWith('{')) {
      try {
        const parsed = JSON.parse(scannedCode);
        if (parsed.token) {
          token = parsed.token;
        }
      } catch (e) {
        // Ignorar error de JSON parse y usar el string plano
      }
    }

    const admin = this.supabase.getSupabaseAdminClient();

    // 1. Verificar visitas de residentes (visitas_registro) -> Tokens de 8 dígitos numéricos
    if (token.length === 8 && /^\d+$/.test(token)) {
      const { data: visitaReg, error: errorReg } = await admin
        .from('visitas_registro')
        .select('*')
        .eq('token_qr', token)
        .eq('estado', 'programada')
        .maybeSingle();

      if (!errorReg && visitaReg) {
        // Verificar vigencia (Ej: fecha_esperada es hoy)
        const hoy = new Date().toISOString().split('T')[0];
        if (visitaReg.fecha_esperada && !visitaReg.fecha_esperada.startsWith(hoy)) {
          this.logger.warn(`⚠️ [QR AUTO-OPEN] Token de residente fuera de fecha. ID: ${visitaReg.id}, Esperada: ${visitaReg.fecha_esperada}`);
          return;
        }

        this.logger.log(`🔑 [QR AUTO-OPEN] Token QR de residente válido: ${token} para visitante ${visitaReg.nombre_visitante_temporal || 'Invitado'}`);
        
        const { error: updErr } = await admin
          .from('visitas_registro')
          .update({
            estado: 'activo',
            fecha_entrada: new Date().toISOString(),
            observaciones: (visitaReg.observaciones || '') + ' [Ingreso automático por código QR]',
          })
          .eq('id', visitaReg.id);

        if (updErr) {
          this.logger.error(`❌ [QR AUTO-OPEN] No se pudo activar la visita de residente ${visitaReg.id}: ${updErr.message}`);
          return;
        }

        await this.triggerDoorOpen(evento.dispositivo_id);
        return;
      }
    }

    // 2. Verificar visitas de la administración (visitas_acceso)
    const { data: visitaAcc, error: errorAcc } = await admin
      .from('visitas_acceso')
      .select('*, dispositivo:dispositivos_iot(id, ip_direccion, nombre_identificador, credencial_usuario, credencial_password, configuracion_tecnica)')
      .eq('token_qr', token)
      .eq('estado', 'programada')
      .maybeSingle();

    if (!errorAcc && visitaAcc) {
      // Restricción de dispositivo: "solo en el dispositivo que se envio"
      if (visitaAcc.dispositivo_id && visitaAcc.dispositivo_id !== evento.dispositivo_id) {
        this.logger.warn(`⚠️ [QR AUTO-OPEN] Token QR válido pero presentado en dispositivo equivocado. Esperado: ${visitaAcc.dispositivo_id}, Escaneado: ${evento.dispositivo_id}`);
        return;
      }

      // Verificar vencimiento de fecha
      const ahora = new Date();
      if (visitaAcc.fecha_vencimiento && ahora > new Date(visitaAcc.fecha_vencimiento)) {
        this.logger.warn(`⚠️ [QR AUTO-OPEN] Intento de ingreso con QR vencido. ID Visita: ${visitaAcc.id}, Expiró: ${visitaAcc.fecha_vencimiento}`);
        await admin.from('visitas_acceso').update({ estado: 'vencida', updated_at: ahora.toISOString() }).eq('id', visitaAcc.id);
        return;
      }

      // Verificar si es muy temprano (más de 30 minutos antes de la hora programada)
      const diffMs = new Date(visitaAcc.fecha_programada).getTime() - ahora.getTime();
      if (diffMs > 30 * 60 * 1000) {
        this.logger.warn(`⚠️ [QR AUTO-OPEN] Intento de ingreso demasiado temprano. ID Visita: ${visitaAcc.id}, Programada: ${visitaAcc.fecha_programada}`);
        return;
      }

      this.logger.log(`🔑 [QR AUTO-OPEN] Token QR de administración válido: ${token} para visitante ${visitaAcc.nombre_visitante}`);

      // Abrir la puerta inmediatamente
      await this.triggerDoorOpen(evento.dispositivo_id);

      // Esperar 1.5 segundos para que la persona ingrese / mire la cámara y capturar su foto
      setTimeout(async () => {
        let fotoIngresoUrl: string | null = null;
        if (visitaAcc.dispositivo?.ip_direccion) {
          try {
            const ip = visitaAcc.dispositivo.ip_direccion;
            const user = visitaAcc.dispositivo.credencial_usuario || 'admin';
            const pass = visitaAcc.dispositivo.credencial_password || '';
            const port = visitaAcc.dispositivo.configuracion_tecnica?.puertos_mapeados?.mapped_http 
              || visitaAcc.dispositivo.configuracion_tecnica?.puerto 
              || 80;

            let responseData: any;
            try {
              responseData = await this.executeDigestRequest(
                'GET',
                `http://${ip}:${port}/ISAPI/Streaming/channels/1/picture`,
                user,
                pass,
                null,
                'image/jpeg',
                5000,
                'arraybuffer'
              );
            } catch (err) {
              this.logger.log(`⚠️ [QR AUTO-OPEN] Fallback to channel 101 picture for device ${visitaAcc.dispositivo_id}`);
              responseData = await this.executeDigestRequest(
                'GET',
                `http://${ip}:${port}/ISAPI/Streaming/channels/101/picture`,
                user,
                pass,
                null,
                'image/jpeg',
                5000,
                'arraybuffer'
              );
            }

            const buffer = Buffer.from(responseData.data);
            const fileName = `visitas/${visitaAcc.id}/ingreso_${Date.now()}.jpg`;
            await admin.storage.from('control-acceso').upload(fileName, buffer, { contentType: 'image/jpeg', upsert: true });
            const { data: urlData } = admin.storage.from('control-acceso').getPublicUrl(fileName);
            fotoIngresoUrl = urlData?.publicUrl || null;
            this.logger.log(`📸 [QR AUTO-OPEN] Foto de ingreso capturada y subida exitosamente: ${fotoIngresoUrl}`);
          } catch (photoErr) {
            this.logger.warn(`⚠️ [QR AUTO-OPEN] No se pudo capturar la foto del dispositivo: ${photoErr.message}`);
          }
        }

        // Actualizar estado de la visita a realizada (incluso si falla la captura de foto)
        const { error: updAccErr } = await admin
          .from('visitas_acceso')
          .update({
            estado: 'realizada',
            timestamp_ingreso: new Date().toISOString(),
            foto_ingreso_url: fotoIngresoUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', visitaAcc.id);

        if (updAccErr) {
          this.logger.error(`❌ [QR AUTO-OPEN] Error al registrar ingreso en visitas_acceso: ${updAccErr.message}`);
        } else {
          this.logger.log(`✅ [QR AUTO-OPEN] Ingreso registrado con éxito para visitante ${visitaAcc.nombre_visitante}`);
        }
      }, 1500);
    }
  }
}
