import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import axios from 'axios';
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

      const eventId = `hik_push_${device.id}_${info?.serialNo || info?.dateTime || Date.now()}`;
      if (this.seenEventIds.has(eventId)) return { ok: true, duplicado: true };
      this.markAsSeen(eventId);

      const evento: EventoAcceso = {
        dispositivo_id: device.id,
        nombre_dispositivo: device.nombre_identificador,
        tipo_evento: this.mapHikvisionEventType(info?.major, info?.minor, info?.eventType),
        metodo_acceso: this.mapHikvisionMethod(info?.cardReaderKind),
        nombre_persona: this.firstText(info?.name, info?.employeeName, info?.userName, info?.UserName),
        documento_persona: this.firstText(info?.employeeNoString, info?.employeeNo, info?.userID, info?.UserID, info?.personId),
        codigo_tarjeta: this.firstText(info?.cardNo, info?.CardNo, info?.cardNumber),
        face_id_ref: this.firstText(info?.FPID, info?.faceID, info?.faceId),
        foto_evidencia_url: this.firstText(info?.pictureURL, info?.picUrl, info?.faceURL),
        timestamp: info?.dateTime || new Date().toISOString(),
        detalles_raw: info,
      };

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

      if (marca.includes('hikvision') || marca.includes('hik')) {
        // Intentar registrar el webhook en Hikvision
        await this.registerHikvisionWebhook(device, ip, port, user, pass, webhookBase).catch(() => {
          // Si falla el registro (cámara no soporta push), usar fallback polling
          this.startFallbackPolling(device, ip, port, user, pass, marca);
        });
      } else if (marca.includes('dahua')) {
        await this.registerDahuaWebhook(device, ip, port, user, pass, webhookBase).catch(() => {
          this.startFallbackPolling(device, ip, port, user, pass, marca);
        });
      } else {
        // Genérico: intentar Hikvision, si falla usar fallback
        await this.registerHikvisionWebhook(device, ip, port, user, pass, webhookBase).catch(() => {
          this.startFallbackPolling(device, ip, port, user, pass, 'hikvision');
        });
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

    await axios.put(
      `${base}/ISAPI/Event/notification/httpHosts/1`,
      payload,
      { auth, timeout: 5_000, headers: { 'Content-Type': 'application/xml' } }
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

    await axios.get(
      `${base}/cgi-bin/configManager.cgi?action=setConfig&VSP_IPAddress[0].Enable=true&VSP_IPAddress[0].Address=${encodeURIComponent(webhookUrl)}&VSP_IPAddress[0].Protocol=${protocol}`,
      { auth, timeout: 5_000 }
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
      const auth = { username: user, password: pass };

      const resp = await axios.post(
        `${base}/ISAPI/AccessControl/AcsEvent?format=json`,
        { 
          AcsEventCond: { 
            searchID: `fb_${device.id}_${Date.now()}`, 
            searchResultPosition: 0, 
            maxResults: 20, 
            major: 0, 
            minor: 0 
          } 
        },
        { auth, timeout: 5_000, headers: { 'Content-Type': 'application/json' } }
      );

      const infos = resp.data?.AcsEvent?.InfoList || [];
      const lastDbTimeStr = this.latestDbTimestamp.get(device.id) || new Date(0).toISOString();
      const lastDbTime = new Date(lastDbTimeStr).getTime();

      for (const info of infos) {
        const eventTimeStr = info.time || new Date().toISOString();
        const eventTime = new Date(eventTimeStr).getTime();

        if (eventTime <= lastDbTime) continue;

        const eventId = `fb_${device.id}_${info.serialNo || info.time}`;
        if (this.seenEventIds.has(eventId)) continue;
        this.markAsSeen(eventId);

        if (eventTime > new Date(this.latestDbTimestamp.get(device.id) || 0).getTime()) {
          this.latestDbTimestamp.set(device.id, eventTimeStr);
        }

        this.saveAndEmit({
          dispositivo_id: device.id,
          nombre_dispositivo: device.nombre_identificador,
          tipo_evento: this.mapHikvisionEventType(info.major, info.minor, ''),
          metodo_acceso: this.mapHikvisionMethod(info.cardReaderKind),
          nombre_persona: this.firstText(info.name, info.employeeName, info.userName),
          documento_persona: this.firstText(info.employeeNoString, info.employeeNo, info.userID, info.personId),
          codigo_tarjeta: this.firstText(info.cardNo, info.CardNo, info.cardNumber),
          face_id_ref: this.firstText(info.FPID, info.faceID, info.faceId),
          foto_evidencia_url: this.firstText(info.pictureURL, info.picUrl, info.faceURL),
          timestamp: eventTimeStr,
          detalles_raw: info,
        });
      }
    } catch { /* offline — silencioso */ }
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

  private mapHikvisionEventType(major: number, minor: number, eventType: string): string {
    // Intercomunicador / Timbre
    if (major === 3 || minor === 44 || minor === 9 || minor === 22 || String(eventType).toLowerCase().includes('call') || String(eventType).toLowerCase().includes('ring')) {
      return 'llamada';
    }
    if (major === 5) {
      if (minor === 75) return 'entrada';
      if (minor === 76) return 'salida';
      return 'acceso';
    }
    if (major === 6) return 'alarma';
    if (major === 1 || eventType === 'doorOpen') return 'puerta_abierta';
    if (major === 2 || eventType === 'doorClose') return 'puerta_cerrada';
    return 'evento';
  }

  private mapHikvisionMethod(kind: number): string {
    return { 1: 'tarjeta', 2: 'pin', 3: 'tarjeta_pin', 4: 'facial', 7: 'facial_tarjeta', 8: 'boton' }[kind] || 'desconocido';
  }

  // ─── Guardar en BD y Emitir por WebSocket (fire & forget) ─────────────────

  saveAndEmit(evento: EventoAcceso) {
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
      const { data, error } = await admin
        .from('personas_gestion_acceso')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) {
        this.logger.warn(`⚠️ [EventSystem] Persona no actualizada: ${error.message}`);
        return existing;
      }
      return data;
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

  private async checkQrAutoOpen(evento: EventoAcceso) {
    const scannedCode = this.firstText(evento.codigo_tarjeta, evento.documento_persona);
    if (!scannedCode || scannedCode.length !== 8 || !/^\d+$/.test(scannedCode)) {
      return;
    }

    const admin = this.supabase.getSupabaseAdminClient();
    const { data: visita, error } = await admin
      .from('visitas_registro')
      .select('*')
      .eq('token_qr', scannedCode)
      .eq('estado', 'programada')
      .maybeSingle();

    if (error || !visita) return;

    this.logger.log(`🔑 [QR AUTO-OPEN] Token QR válido detectado: ${scannedCode} para visitante ${visita.nombre_visitante_temporal || 'Invitado'}`);

    const { error: updErr } = await admin
      .from('visitas_registro')
      .update({
        estado: 'activo',
        fecha_entrada: new Date().toISOString(),
        observaciones: (visita.observaciones || '') + ' [Ingreso automático por código QR]',
      })
      .eq('id', visita.id);

    if (updErr) {
      this.logger.error(`❌ [QR AUTO-OPEN] No se pudo activar la visita ${visita.id}: ${updErr.message}`);
      return;
    }

    if (this.controlPuertaFn) {
      try {
        const device = await this.getDeviceById(evento.dispositivo_id);
        if (device?.ip_direccion) {
          await this.controlPuertaFn(device.ip_direccion, 1, 'abrir', {
            deviceId: device.id,
            marca: device.configuracion_tecnica?.marca,
          });
          this.logger.log(`🚪 [QR AUTO-OPEN] Puerta abierta automáticamente para visita ${visita.id}`);
        }
      } catch (cmdErr) {
        this.logger.error(`❌ [QR AUTO-OPEN] Error al enviar comando de puerta: ${cmdErr.message}`);
      }
    } else {
      this.logger.warn(`⚠️ [QR AUTO-OPEN] controlPuertaFn no está registrado en el sistema`);
    }
  }
}
