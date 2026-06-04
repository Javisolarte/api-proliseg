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

  /** IDs ya procesados para deduplicar — en memoria, bajo consumo */
  private readonly seenEventIds = new Set<string>();

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
      this.seenEventIds.add(eventId);

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
      this.seenEventIds.add(eventId);

      const evento: EventoAcceso = {
        dispositivo_id: device.id,
        nombre_dispositivo: device.nombre_identificador,
        tipo_evento: payload?.Action === 'Start' ? 'entrada' : 'salida',
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
    await this.setupAllDevices();
  }

  // ─── Setup inicial: registro de webhooks en cámaras ──────────────────────

  private async setupAllDevices() {
    const { data: devices } = await this.supabase
      .getClient()
      .from('dispositivos_iot')
      .select('id, nombre_identificador, ip_direccion, credencial_usuario, credencial_password, configuracion_tecnica')
      .in('estado', ['operativo', 'mantenimiento']);

    if (!devices?.length) return;

    // URL pública donde las cámaras deben mandar sus eventos
    const webhookBase = 'https://servidor.proliseg.com/api/control-acceso/webhook/evento';

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
    const webhookUrl = `${webhookBase}/hik/${device.id}`;

    const payload = `<?xml version="1.0" encoding="UTF-8"?>
<HttpHostNotificationList>
  <HttpHostNotification version="2.0">
    <id>1</id>
    <url>${webhookUrl}</url>
    <protocolType>HTTP</protocolType>
    <parameterFormatType>JSON</parameterFormatType>
    <addressingFormatType>ipaddress</addressingFormatType>
    <hostName>${webhookUrl}</hostName>
    <ipAddress>servidor.proliseg.com</ipAddress>
    <portNo>443</portNo>
    <httpAuthenticationMethod>none</httpAuthenticationMethod>
  </HttpHostNotification>
</HttpHostNotificationList>`;

    await axios.put(
      `${base}/ISAPI/Event/notification/httpHosts/1`,
      payload,
      { auth, timeout: 5_000, headers: { 'Content-Type': 'application/xml' } }
    );

    this.logger.log(`✅ [EventSystem] Webhook Hikvision registrado → ${device.nombre_identificador}`);
  }

  // ─── Registro de webhook en Dahua CGI ─────────────────────────────────────

  private async registerDahuaWebhook(
    device: DeviceInfo, ip: string, port: number, user: string, pass: string, webhookBase: string
  ) {
    const base = `http://${ip}:${port}`;
    const auth = { username: user, password: pass };
    const webhookUrl = `${webhookBase}/dahua/${device.id}`;

    await axios.get(
      `${base}/cgi-bin/configManager.cgi?action=setConfig&VSP_IPAddress[0].Enable=true&VSP_IPAddress[0].Address=${encodeURIComponent(webhookUrl)}&VSP_IPAddress[0].Protocol=HTTP`,
      { auth, timeout: 5_000 }
    );

    this.logger.log(`✅ [EventSystem] Webhook Dahua registrado → ${device.nombre_identificador}`);
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
      const now = new Date();
      const startTime = new Date(now.getTime() - this.FALLBACK_POLL_MS - 5_000).toISOString().replace('.000', '');
      const endTime = now.toISOString().replace('.000', '');
      const base = `http://${ip}:${port}`;
      const auth = { username: user, password: pass };

      const resp = await axios.post(
        `${base}/ISAPI/AccessControl/AcsEvent?format=json`,
        { AcsEventCond: { searchID: `fb_${Date.now()}`, searchResultPosition: 0, maxResults: 10, major: 0, minor: 0, startTime, endTime } },
        { auth, timeout: 5_000, headers: { 'Content-Type': 'application/json' } }
      );

      const infos = resp.data?.AcsEvent?.InfoList || [];
      for (const info of infos) {
        const eventId = `fb_${device.id}_${info.serialNo || info.time}`;
        if (this.seenEventIds.has(eventId)) continue;
        this.seenEventIds.add(eventId);

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
          timestamp: info.time || new Date().toISOString(),
          detalles_raw: info,
        });
      }
    } catch { /* offline — silencioso */ }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async getDeviceById(idOrIp: string): Promise<DeviceInfo | null> {
    const { data } = await this.supabase.getClient()
      .from('dispositivos_iot')
      .select('id, nombre_identificador, ip_direccion, credencial_usuario, credencial_password, configuracion_tecnica')
      .or(`id.eq.${idOrIp},ip_direccion.eq.${idOrIp}`)
      .single();
    return data as DeviceInfo | null;
  }

  private mapHikvisionEventType(major: number, minor: number, eventType: string): string {
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
      const persona = await this.resolvePersonaForEvento(evento);
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
    const admin = this.supabase.getSupabaseAdminClient();
    const lookups = [
      { field: 'documento_identidad', value: documento },
      { field: 'codigo_tarjeta', value: codigoTarjeta },
      { field: 'face_id_ref', value: faceId },
    ].filter(item => !!item.value);

    for (const lookup of lookups) {
      const { data, error } = await admin
        .from('personas_gestion_acceso')
        .select('*')
        .eq(lookup.field, lookup.value as string)
        .maybeSingle();
      if (!error && data) return data;
    }

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
}
