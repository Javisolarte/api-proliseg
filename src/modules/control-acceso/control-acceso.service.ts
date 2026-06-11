import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateDispositivoDto, CreatePersonaAccesoDto } from './dto/control-acceso.dto';
import { randomBytes, createHash } from 'crypto';
import { DevicePollerService } from './device-poller.service';
import { spawn } from 'child_process';

@Injectable()
export class ControlAccesoService implements OnModuleInit {
  private readonly logger = new Logger(ControlAccesoService.name);

  private readonly proxyUrl = 'https://servidor.proliseg.com/dispositivos';
  private readonly apiKey = 'proliseg-acceso-2026';
  private digestChallengeCache = new Map<string, { realm: string; nonce: string; qop: string }>();
  private deviceCodecCache = new Map<string, string>();
  private readonly audioTalkChannelId = 1;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly devicePoller: DevicePollerService,
  ) { }

  async onModuleInit() {
    this.devicePoller.setControlPuertaFn((ip, doorId, command, options) =>
      this.controlPuerta(ip, doorId, command, options),
    );

    this.logger.log('🚀 [MediaMTX] Iniciando sincronización de cámaras en 5 segundos...');
    // Ejecutar en segundo plano para no bloquear el arranque
    setTimeout(() => {
      this.syncMediaMtxPaths().catch(err => this.logger.error(err));
    }, 5000);
  }

  async cleanWebrtcIceServers() {
    try {
      const domain = 'servidor.proliseg.com';
      const apiAuth = { username: 'admin', password: 'proliseg1025' };

      this.logger.log('🔍 [MediaMTX] Verificando duplicados en webrtcICEServers2...');
      const response = await axios.get(`https://${domain}/webrtc-api/v3/config/global/get`, { auth: apiAuth });
      
      const iceServers = response.data?.webrtcICEServers2;
      if (Array.isArray(iceServers) && iceServers.length > 2) {
        const seen = new Set<string>();
        const uniqueServers = iceServers.filter(server => {
          const key = `${server.url || ''}|${server.username || ''}|${server.password || ''}|${server.clientOnly}`;
          if (seen.has(key)) {
            return false;
          }
          seen.add(key);
          return true;
        });

        if (uniqueServers.length < iceServers.length) {
          this.logger.log(`🧹 [MediaMTX] Detectados ${iceServers.length} servidores ICE. Limpiando a ${uniqueServers.length} únicos...`);
          await axios.patch(
            `https://${domain}/webrtc-api/v3/config/global/patch`,
            { webrtcICEServers2: uniqueServers },
            { auth: apiAuth }
          );
          this.logger.log('✅ [MediaMTX] webrtcICEServers2 limpiado con éxito.');
        } else {
          this.logger.log('ℹ️ [MediaMTX] No se detectaron servidores ICE duplicados.');
        }
      }
    } catch (error) {
      this.logger.warn(`⚠️ [MediaMTX] Error al limpiar webrtcICEServers2: ${error.message}`);
    }
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async handleCleanIceServersCron() {
    this.logger.log('⏰ [Cron] Iniciando limpieza de servidores ICE en MediaMTX...');
    await this.cleanWebrtcIceServers();
  }

  async syncMediaMtxPaths() {
    try {
      // Limpiar automáticamente duplicados en servidores ICE de MediaMTX
      await this.cleanWebrtcIceServers();

      const { data: devices, error } = await this.supabase
        .getClient()
        .from('dispositivos_iot')
        .select('id')
        .in('estado', ['operativo', 'mantenimiento']);

      if (error) throw error;

      if (devices && devices.length > 0) {
        this.logger.log(`🔄 [MediaMTX] Sincronizando ${devices.length} dispositivos de video...`);
        for (const dev of devices) {
          try {
            await this.startVideoStream(dev.id);
          } catch (e) {
            this.logger.warn(`⚠️ [MediaMTX] Error al sincronizar cámara ${dev.id}: ${e.message}`);
          }
        }
        this.logger.log('✅ [MediaMTX] Sincronización de cámaras completada con éxito.');
      }
    } catch (error) {
      this.logger.error(`❌ [MediaMTX] Error crítico en sincronización inicial: ${error.message}`);
    }
  }

  /**
   * DATABASE METHODS (SUPABASE)
   */

  async findAllDispositivos() {
    const { data, error } = await this.supabase
      .getClient()
      .from('dispositivos_iot')
      .select('*, puesto:puestos_trabajo(nombre)');
    if (error) throw error;

    const ids = (data || []).map((device: any) => device.id);
    if (!ids.length) return data || [];

    const { data: permisos } = await this.supabase
      .getClient()
      .from('acceso_permisos_dispositivos')
      .select('dispositivo_id')
      .in('dispositivo_id', ids)
      .eq('activo', true);

    const counts = (permisos || []).reduce((acc: Record<string, number>, permiso: any) => {
      acc[permiso.dispositivo_id] = (acc[permiso.dispositivo_id] || 0) + 1;
      return acc;
    }, {});

    return (data || []).map((device: any) => ({
      ...device,
      total_personas: counts[device.id] || 0,
    }));
  }

  async createDispositivo(dto: any) {
    const { mikrotik_ip, mikrotik_usuario, mikrotik_password, mikrotik_puerto, ...insertData } = dto;

    let finalIp = insertData.ip_direccion;
    let finalPort = insertData.puerto_servicio || 80;
    const originalHttpPort = insertData.puerto_servicio || insertData.configuracion_tecnica?.puerto || 80;
    const originalRtspPort = insertData.configuracion_tecnica?.puerto_rtsp || insertData.puerto_rtsp || 554;

    // Usar puertos_mapeados del frontend si existen, sino usar un objeto vacío
    let mappedPortsInfo = insertData.configuracion_tecnica?.puertos_mapeados || {};

    // IP local de la cámara para la regla NAT en MikroTik (ej. 192.168.1.150)
    const local_ip = insertData.ip_local || insertData.ip_direccion;

    if (mikrotik_ip && local_ip) {
      // Se escaneó vía MikroTik, mapear el reenvío de puertos NAT
      try {
        const lastOctet = local_ip.split('.').pop();
        const baseOffset = Number(lastOctet || '80');

        const mappedHttpPort = 10000 + baseOffset;
        const mappedSdkPort = 20000 + baseOffset;
        const mappedRtspPort = 30000 + baseOffset;

        this.logger.log(`🔧 [NAT MAPPING] Creando reglas NAT en MikroTik ${mikrotik_ip} hacia ${local_ip}...`);

        // Mapear HTTP (80)
        const finalActivePort = await this.addMikrotikNatRule(
          mikrotik_ip, local_ip, mappedHttpPort, mikrotik_usuario, mikrotik_password, mikrotik_puerto, '80'
        );

        // Mapear SDK (8000)
        await this.addMikrotikNatRule(
          mikrotik_ip, local_ip, mappedSdkPort, mikrotik_usuario, mikrotik_password, mikrotik_puerto, '8000'
        );

        // Mapear RTSP (554) - TCP
        await this.addMikrotikNatRule(
          mikrotik_ip, local_ip, mappedRtspPort, mikrotik_usuario, mikrotik_password, mikrotik_puerto, '554', 'tcp'
        );

        // Mapear RTSP (554) - UDP (Requerido por algunas cámaras genéricas)
        await this.addMikrotikNatRule(
          mikrotik_ip, local_ip, mappedRtspPort, mikrotik_usuario, mikrotik_password, mikrotik_puerto, '554', 'udp'
        );

        // Actualizar detalles del dispositivo con el puerto mapeado HTTP principal
        // NO sobrescribimos finalIp porque la VPN (10.8.0.2) es la mejor ruta para MediaMTX
        finalPort = finalActivePort;

        // Actualizar mappedPortsInfo si el NAT fue exitoso
        mappedPortsInfo = {
          mapped_http: mappedHttpPort,
          mapped_sdk: mappedSdkPort,
          mapped_rtsp: mappedRtspPort,
          original_http: originalHttpPort,
          original_rtsp: originalRtspPort,
          original_ip: local_ip
        };
      } catch (err) {
        this.logger.error(`❌ [NAT MAPPING ERROR] Falló la creación de regla NAT: ${err.message}`);
      }
    }

    const payload = {
      nombre_identificador: insertData.nombre_identificador || insertData.nombre || 'Nuevo Dispositivo',
      puesto_id: insertData.puesto_id || null,
      ip_direccion: finalIp,
      sn_serie: insertData.sn_serie || insertData.sn_serial || 'UNKNOWN',
      credencial_usuario: insertData.dispositivo_usuario || 'admin',
      credencial_password: insertData.dispositivo_password || '',
      estado: insertData.estado || 'operativo',
      configuracion_tecnica: {
        marca: insertData.configuracion_tecnica?.marca || insertData.marca || 'Hikvision',
        modelo: insertData.configuracion_tecnica?.modelo || insertData.modelo || '',
        puerto: finalPort,
        puerto_http_original: originalHttpPort,
        puerto_rtsp: originalRtspPort,
        tipo: insertData.tipo || 'control_acceso',
        esta_online: true,
        puertos_mapeados: {
          ...mappedPortsInfo,
          original_http: mappedPortsInfo.original_http || originalHttpPort,
          original_rtsp: mappedPortsInfo.original_rtsp || originalRtspPort,
        }
      }
    };

    const { data, error } = await this.supabase
      .getClient()
      .from('dispositivos_iot')
      .upsert([payload], { onConflict: 'sn_serie' })
      .select();

    if (error) {
      this.logger.error(`❌ [CREATE DISPOSITIVO ERROR] Error de base de datos al registrar: ${error.message} - Code: ${error.code}`);
      throw error;
    }
    await this.devicePoller.refreshDeviceList().catch(err => 
      this.logger.warn(`⚠️ [CACHE WARN] No se pudo refrescar el poller de dispositivos: ${err.message}`)
    );
    return data[0];
  }

  async updateDispositivo(id: string, dto: any) {
    const { data: current } = await this.supabase
      .getClient()
      .from('dispositivos_iot')
      .select('configuracion_tecnica')
      .eq('id', id)
      .maybeSingle();

    const currentConfig = current?.configuracion_tecnica || {};
    const incomingConfig = dto.configuracion_tecnica || {};

    const payload = {
      nombre_identificador: dto.nombre_identificador || dto.nombre,
      puesto_id: dto.puesto_id || null,
      ip_direccion: dto.ip_direccion || dto.ip,
      sn_serie: dto.sn_serie || dto.sn_serial,
      credencial_usuario: dto.dispositivo_usuario || dto.credencial_usuario || 'admin',
      credencial_password: dto.dispositivo_password || dto.credencial_password || '',
      estado: dto.estado || 'operativo',
      configuracion_tecnica: {
        ...currentConfig,
        ...incomingConfig,
        marca: incomingConfig?.marca || dto.marca || currentConfig?.marca || 'Hikvision',
        modelo: incomingConfig?.modelo || dto.modelo || currentConfig?.modelo || '',
        puerto: incomingConfig?.puerto || dto.puerto_servicio || dto.puerto || currentConfig?.puerto || 80,
        puerto_http_original: incomingConfig?.puerto_http_original || currentConfig?.puerto_http_original || dto.puerto_servicio || dto.puerto || 80,
        puerto_rtsp: incomingConfig?.puerto_rtsp || currentConfig?.puerto_rtsp || 554,
        tipo: dto.tipo || incomingConfig?.tipo || currentConfig?.tipo || 'control_acceso',
        esta_online: dto.esta_online ?? incomingConfig?.esta_online ?? currentConfig?.esta_online ?? true,
        puertos_mapeados: {
          ...(currentConfig?.puertos_mapeados || {}),
          ...(incomingConfig?.puertos_mapeados || {}),
          original_http: incomingConfig?.puertos_mapeados?.original_http
            || currentConfig?.puertos_mapeados?.original_http
            || incomingConfig?.puerto_http_original
            || currentConfig?.puerto_http_original
            || dto.puerto_servicio
            || dto.puerto
            || 80,
          original_rtsp: incomingConfig?.puertos_mapeados?.original_rtsp
            || currentConfig?.puertos_mapeados?.original_rtsp
            || incomingConfig?.puerto_rtsp
            || currentConfig?.puerto_rtsp
            || 554,
        }
      }
    };

    const { data, error } = await this.supabase
      .getClient()
      .from('dispositivos_iot')
      .update(payload)
      .eq('id', id)
      .select();
    if (error) throw error;
    await this.devicePoller.refreshDeviceList().catch(err => 
      this.logger.warn(`⚠️ [CACHE WARN] No se pudo refrescar el poller de dispositivos: ${err.message}`)
    );
    return data[0];
  }

  async deleteDispositivo(id: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('dispositivos_iot')
      .delete()
      .eq('id', id)
      .select();
    if (error) throw error;
    await this.devicePoller.refreshDeviceList().catch(err => 
      this.logger.warn(`⚠️ [CACHE WARN] No se pudo refrescar el poller de dispositivos: ${err.message}`)
    );
    return data[0];
  }

  async getEventosHistorial(opts: { dispositivoId?: string; limit?: number; desde?: string }) {
    let query = this.supabase
      .getClient()
      .from('dispositivos_eventos_historico')
      .select(`
        *,
        dispositivo:dispositivos_iot(nombre_identificador, ip_direccion),
        persona:personas_gestion_acceso(id, nombre_completo, documento_identidad, codigo_tarjeta, face_id_ref)
      `)
      .order('timestamp', { ascending: false })
      .limit(opts.limit || 50);

    if (opts.dispositivoId) query = query.eq('dispositivo_id', opts.dispositivoId);
    if (opts.desde) query = query.gte('timestamp', opts.desde);

    const { data, error } = await query;
    if (error) throw error;
    return this.attachFotosPersonas(data || []);
  }

  // ============================================================
  //  CONTROL DE PUERTAS — Motor multi-marca
  // ============================================================

  /**
   * Detecta la marca del dispositivo y ejecuta el comando adecuado.
   * @param ip       IP pública del dispositivo (ej: 10.8.0.2)
   * @param doorId   Número de puerta (1 = primera puerta, default)
   * @param command  abrir | cerrar | siempre-abierta | siempre-cerrada
   * @param options  usuario, contraseña y puerto mapeado opcionales
   */
  async controlPuerta(
    ip: string,
    doorId: number = 1,
    command: 'abrir' | 'cerrar' | 'siempre-abierta' | 'siempre-cerrada',
    options?: { user?: string; pass?: string; port?: number; marca?: string; deviceId?: string; operator?: any }
  ): Promise<{ ok: boolean; mensaje: string; marca?: string; detalle?: any }> {
    this.logger.log(`🚪 [PUERTA] Comando "${command}" → IP ${ip} | Puerta ${doorId}`);
 
    // Detectar marca desde la base de datos si se provee deviceId
    let marca = options?.marca?.toLowerCase() || 'hikvision';
    let user = options?.user || 'admin';
    let pass = options?.pass || 'proliseg1025';
    let port = options?.port || 80;
    let targetIp = ip;
    let deviceConfig: any = null;
 
    if (options?.deviceId) {
      const { data: dev } = await this.supabase
        .getClient()
        .from('dispositivos_iot')
        .select('ip_direccion, credencial_usuario, credencial_password, configuracion_tecnica')
        .eq('id', options.deviceId)
        .maybeSingle();
 
      if (dev) {
        deviceConfig = dev.configuracion_tecnica || {};
        targetIp = dev.ip_direccion || targetIp;
        user = dev.credencial_usuario || user;
        pass = dev.credencial_password || pass;
        marca = deviceConfig?.marca?.toLowerCase() || marca;
        port = Number(deviceConfig?.puerto || port);
      }
    }
 
    if (!targetIp) {
      return { ok: false, mensaje: 'No hay IP o dispositivo destino para ejecutar el comando de puerta' };
    }
 
    const target = await this.resolveDoorNetworkTarget(targetIp, port, deviceConfig);
 
    try {
      let resultado: { ok: boolean; mensaje: string; marca?: string; detalle?: any };
 
      if (marca.includes('hikvision') || marca.includes('hik')) {
        resultado = await this.controlPuertaHikvision(target.ip, target.port, doorId, command, user, pass);
      } else if (marca.includes('dahua') || marca.includes('dh')) {
        resultado = await this.controlPuertaDahua(target.ip, target.port, doorId, command, user, pass);
      } else {
        // Intento genérico: probamos Hikvision primero, luego Dahua
        try {
          const resultado = await this.controlPuertaHikvision(target.ip, target.port, doorId, command, user, pass);
          return this.registrarResultadoPuerta(targetIp, doorId, command, options?.deviceId, { ...resultado, marca: 'Hikvision (auto-detectado)' }, options?.operator);
        } catch {
          const resultado = await this.controlPuertaDahua(target.ip, target.port, doorId, command, user, pass);
          return this.registrarResultadoPuerta(targetIp, doorId, command, options?.deviceId, { ...resultado, marca: 'Dahua (auto-detectado)' }, options?.operator);
        }
      }
 
      return this.registrarResultadoPuerta(targetIp, doorId, command, options?.deviceId, {
        ...resultado,
        detalle: {
          ...(resultado.detalle || {}),
          target: `${target.ip}:${target.port}`,
          via: target.via,
        },
      }, options?.operator);
    } catch (err) {
      this.logger.error(`❌ [PUERTA ERROR] ${err.message}`);
      return { ok: false, mensaje: `Error al ejecutar comando: ${err.message}` };
    }
  }

  private async resolveDoorNetworkTarget(ip: string, configuredPort: number, config: any = {}) {
    const mappedHttp = Number(config?.puertos_mapeados?.mapped_http || 0);
    const originalHttp = Number(
      config?.puertos_mapeados?.original_http
      || config?.puerto_http_original
      || configuredPort
      || 80
    );

    if (this.isVpnIp(ip)) {
      return { ip, port: mappedHttp || originalHttp || 80, via: 'vpn' };
    }

    if (this.isPrivateIp(ip)) {
      const { data: servers } = await this.supabase
        .getClient()
        .from('control_acceso_servidores_mikrotik')
        .select('ip_publica')
        .limit(1);

      const publicIp = servers?.[0]?.ip_publica;
      if (publicIp) {
        const lastOctet = Number(ip.split('.').pop() || '80');
        return { ip: publicIp, port: mappedHttp || 10000 + lastOctet, via: 'mikrotik-nat' };
      }
    }

    return { ip, port: Number(configuredPort || 80), via: 'directo' };
  }

  private async resolveAudioNetworkTarget(targetIp: string, deviceId?: string) {
    const [rawHost, rawPort] = this.splitHostPort(targetIp);
    let host = rawHost || targetIp;
    let port = Number(rawPort || 0) || 80;
    let user = 'admin';
    let pass = '';
    let config: any = {};

    let dev: any = null;

    if (deviceId && deviceId !== 'undefined') {
      const { data } = await this.supabase
        .getSupabaseAdminClient()
        .from('dispositivos_iot')
        .select('ip_direccion, credencial_usuario, credencial_password, configuracion_tecnica')
        .eq('id', deviceId)
        .maybeSingle();
      dev = data;
    }

    // Si no se encontró el dispositivo por ID (o no se envió), buscar por IP y puerto
    if (!dev && host) {
      const { data: devices } = await this.supabase
        .getSupabaseAdminClient()
        .from('dispositivos_iot')
        .select('ip_direccion, credencial_usuario, credencial_password, configuracion_tecnica')
        .eq('ip_direccion', host);

      if (devices && devices.length > 0) {
        // Encontrar el dispositivo que coincida con el puerto configurado
        dev = devices.find(d => {
          const p = Number(d.configuracion_tecnica?.puerto || 80);
          return p === port;
        }) || devices[0];
      }
    }

    if (dev) {
      host = dev.ip_direccion || host;
      user = dev.credencial_usuario || user;
      pass = dev.credencial_password || pass;
      config = dev.configuracion_tecnica || {};
      port = Number(config?.puerto || port || 80);
    }

    const resolved = await this.resolveDoorNetworkTarget(host, port, config);
    return {
      host: resolved.ip,
      port: resolved.port,
      via: resolved.via,
      user,
      pass,
    };
  }

  private splitHostPort(value: string): [string, string | undefined] {
    if (!value) return ['', undefined];
    const normalized = value.trim();
    const match = normalized.match(/^(.+):(\d+)$/);
    if (match) {
      return [match[1], match[2]];
    }
    return [normalized, undefined];
  }

  private async ensureDigestChallenge(url: string, user: string, pass: string): Promise<void> {
    const host = new URL(url).host;
    if (this.digestChallengeCache.has(host)) return;

    try {
      await this.executeDigestAuthRequest(
        'GET',
        `http://${host}/ISAPI/System/deviceInfo`,
        user,
        pass,
        null,
        'json',
        5000,
      );
    } catch {
      // El objetivo aquí es calentar el cache del digest; si falla,
      // la llamada principal reportará el error real.
    }
  }

  private buildDigestAuthHeader(method: string, url: string, user: string, pass: string): string | null {
    const host = new URL(url).host;
    const cached = this.digestChallengeCache.get(host);
    if (!cached) return null;

    const { realm, nonce, qop } = cached;
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

  async relayAudioToDevice(
    audioStream: NodeJS.ReadableStream,
    targetIp: string,
    deviceId?: string,
    operator?: any,
  ): Promise<any> {
    const target = await this.resolveAudioNetworkTarget(targetIp, deviceId);
    const baseIsapi = `http://${target.host}:${target.port}/ISAPI/System/TwoWayAudio/channels/${this.audioTalkChannelId}`;

    this.logger.log(`🎙️ [AUDIO-IN] Target resolved: host=${target.host}:${target.port}, user=${target.user}, passLength=${target.pass?.length || 0}`);

    let clientDisconnected = false;
    (audioStream as any).on('close', () => {
      clientDisconnected = true;
    });
    (audioStream as any).on('end', () => {
      clientDisconnected = true;
    });

    const deviceHost = `${target.host}:${target.port}`;
    // Limpiar caché de Digest para evitar nonces obsoletos que causen bloqueos 401 en el dispositivo
    this.digestChallengeCache.delete(deviceHost);
    this.digestChallengeCache.delete(target.host);

    const isapiHeaders = {
      'Content-Type': 'application/xml',
      'Accept': 'application/xml',
    };

    // 1. Detectar codec soportado por el dispositivo (usando caché para comunicación inmediata)
    let audioFormat = 'mulaw'; // default G.711 μ-law
    const cachedCodec = this.deviceCodecCache.get(deviceHost);
    if (cachedCodec) {
      audioFormat = cachedCodec;
      this.logger.log(`[AUDIO-IN] Dispositivo usa codec cacheado: G.711 ${audioFormat}`);
    } else {
      try {
        const capResult = await this.executeDigestAuth(
          'GET', baseIsapi, target.user, target.pass, null, 'text', 15000, isapiHeaders
        );
        const capText = typeof capResult === 'string' ? capResult : JSON.stringify(capResult);
        if (/G\.711alaw|alaw/i.test(capText)) {
          audioFormat = 'alaw';
        }
        this.deviceCodecCache.set(deviceHost, audioFormat);
        this.logger.log(`[AUDIO-IN] Codec de dispositivo detectado y cacheado: G.711 ${audioFormat}`);
      } catch (capErr) {
        this.logger.debug(`[AUDIO-IN] No se pudo detectar codec, usando μ-law por defecto: ${capErr.message}`);
      }
    }

    // 0. Cerrar canal previo que pueda haber quedado abierto (ignorar errores)
    try {
      await this.executeDigestAuth('PUT', `${baseIsapi}/close`, target.user, target.pass, '', 'text', 15000, isapiHeaders);
    } catch {}

    // 2. Abrir el canal de audio bidireccional en el dispositivo (Hikvision ISAPI)
    const openPayload = `<?xml version="1.0" encoding="UTF-8"?>
<TwoWayAudioChannel version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
  <id>${this.audioTalkChannelId}</id>
  <audioCompressionType>${audioFormat === 'alaw' ? 'G.711alaw' : 'G.711ulaw'}</audioCompressionType>
</TwoWayAudioChannel>`;

    try {
      this.logger.log(`🎙️ [AUDIO-IN] Abriendo canal de audio en ${target.host}:${target.port}`);
      const openResult = await this.executeDigestAuth('PUT', `${baseIsapi}/open`, target.user, target.pass, openPayload, 'text', 15000, isapiHeaders);
      this.logger.log(`✅ [AUDIO-IN] Canal de audio abierto correctamente`);
    } catch (openErr) {
      this.logger.error(`❌ [AUDIO-IN] FALLO al abrir canal de audio: ${openErr.message}`);
      throw new Error(`No se pudo abrir el canal de audio en el dispositivo: ${openErr.message}`);
    }

    const deviceUrl = `${baseIsapi}/audioData`;

    this.logger.log(`[AUDIO-IN] Enviando audio a ${target.host}:${target.port} (${target.via})${deviceId ? ` device=${deviceId}` : ''}`);

    // 3. Calentar el Digest Auth contra la misma URL para obtener un nonce fresco
    await this.ensureDigestChallenge(deviceUrl, target.user, target.pass);
    const authHeader = this.buildDigestAuthHeader('PUT', deviceUrl, target.user, target.pass);
    if (!authHeader) {
      // Si no hay nonce cacheado, intentar un warmup extra
      this.logger.warn(`⚠️ [AUDIO-IN] No hay nonce cached, calentando Digest Auth...`);
      await this.ensureDigestChallenge(`http://${target.host}:${target.port}/ISAPI/System/deviceInfo`, target.user, target.pass);
      await this.ensureDigestChallenge(deviceUrl, target.user, target.pass);
      const retryHeader = this.buildDigestAuthHeader('PUT', deviceUrl, target.user, target.pass);
      if (!retryHeader) {
        throw new Error('No se pudo construir la autenticación Digest para audio bidireccional');
      }
    }

    const finalAuthHeader = this.buildDigestAuthHeader('PUT', deviceUrl, target.user, target.pass)!;

    return new Promise((resolve, reject) => {
      let req: any = null;

      // ffmpeg: convierte WebM/Opus del navegador → PCM G.711 a/μ-law crudo (sin contenedor WAV)
      const ffmpeg = spawn('ffmpeg', [
        '-hide_banner',
        '-loglevel', 'warning',
        '-f', 'webm',           // Formato de entrada explícito: WebM/Opus del navegador
        '-i', 'pipe:0',
        '-ac', '1',             // Mono
        '-ar', '8000',          // 8kHz (requerido por G.711)
        '-c:a', audioFormat === 'alaw' ? 'pcm_alaw' : 'pcm_mulaw',   // Codec de salida
        '-f', audioFormat,      // Formato de salida: raw alaw/mulaw
        'pipe:1',
      ]);

      let settled = false;
      const finalize = async (fn: (value?: any) => void, value?: any) => {
        if (settled) return;
        settled = true;
        try { (audioStream as any).destroy?.(); } catch {}
        try { ffmpeg.stdin.destroy(); } catch {}
        try { ffmpeg.stdout.destroy(); } catch {}
        try { ffmpeg.kill('SIGKILL'); } catch {}
        try { req?.destroy(); } catch {}

        // 3. Cerrar el canal de audio en el dispositivo
        try {
          this.logger.debug(`[AUDIO-IN] Cerrando canal de audio en ${target.host}:${target.port}`);
          await this.executeDigestAuth('PUT', `${baseIsapi}/close`, target.user, target.pass, '', 'text', 15000, isapiHeaders);
          this.logger.log(`✅ [AUDIO-IN] Canal de audio cerrado`);
        } catch (closeErr) {
          this.logger.warn(`⚠️ [AUDIO-IN] Error al cerrar canal de audio: ${closeErr.message}`);
        }

        fn(value);
      };

      // Realizar la petición PUT de subida en tiempo real usando el módulo nativo http/https
      // Esto evita que Axios bufferice el stream de audio completo en memoria.
      const parsedUrl = new URL(deviceUrl);
      const transport = parsedUrl.protocol === 'https:' ? require('https') : require('http');

      req = transport.request({
        method: 'PUT',
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        headers: {
          'Authorization': finalAuthHeader,
          'Content-Type': 'application/octet-stream',
          'User-Agent': 'PROLISEG-ControlAcceso/1.0',
          'Transfer-Encoding': 'chunked',
          'Connection': 'keep-alive',
        }
      }, (response) => {
        this.logger.log(`[AUDIO-IN] Dispositivo respondió con status ${response.statusCode}`);
        let responseData = '';
        response.on('data', (chunk) => {
          responseData += chunk.toString();
        });
        response.on('end', () => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            finalize(resolve, {
              ok: true,
              mensaje: 'Audio transmitido al dispositivo',
              detalle: {
                target: `${target.host}:${target.port}`,
                via: target.via,
                status: response.statusCode,
              },
              operador: operator || null,
            });
          } else {
            if (response.statusCode === 401) {
              this.logger.error(`❌ [AUDIO-IN] Autenticación rechazada (401) — nonce posiblemente expirado`);
              const host = new URL(deviceUrl).host;
              this.digestChallengeCache.delete(host);
            }
            finalize(reject, new Error(`El dispositivo respondió con estado ${response.statusCode}: ${responseData.substring(0, 200)}`));
          }
        });
      });

      req.on('error', (err) => {
        if (clientDisconnected || (audioStream as any).aborted) {
          this.logger.log(`[AUDIO-IN] Conexión PUT terminada normalmente al colgar/detener.`);
          finalize(resolve, {
            ok: true,
            mensaje: 'Transmisión finalizada',
            detalle: {
              target: `${target.host}:${target.port}`,
              via: target.via,
              status: 'closed',
            },
            operador: operator || null,
          });
          return;
        }
        this.logger.error(`❌ [AUDIO-IN] Error en la conexión PUT audioData: ${err.message}`);
        finalize(reject, err);
      });

      // Pipear el stream de audio transcrito por ffmpeg directamente al socket de la petición HTTP
      ffmpeg.stdout.pipe(req);

      const ffmpegErrors: Buffer[] = [];
      ffmpeg.stderr.on('data', (chunk) => {
        ffmpegErrors.push(Buffer.from(chunk));
        this.logger.debug(`[AUDIO-IN] ffmpeg stderr: ${chunk.toString()}`);
      });
      ffmpeg.on('error', (error) => {
        if (clientDisconnected || (audioStream as any).aborted) {
          finalize(resolve, { ok: true, mensaje: 'Transmisión finalizada' });
          return;
        }
        this.logger.error(`❌ [AUDIO-IN] ffmpeg error: ${error.message}`);
        finalize(reject, error);
      });
      ffmpeg.on('close', (code) => {
        if (code !== 0 && !settled) {
          if (clientDisconnected || (audioStream as any).aborted) {
            finalize(resolve, {
              ok: true,
              mensaje: 'Transmisión finalizada',
              detalle: {
                target: `${target.host}:${target.port}`,
                via: target.via,
                status: 'closed',
              },
              operador: operator || null,
            });
            return;
          }
          const message = Buffer.concat(ffmpegErrors).toString('utf8') || `ffmpeg terminó con código ${code}`;
          this.logger.error(`❌ [AUDIO-IN] ffmpeg cerró con código ${code}: ${message}`);
          finalize(reject, new Error(message));
        }
      });

      audioStream.on('error', (error) => {
        if (clientDisconnected || (audioStream as any).aborted) {
          finalize(resolve, { ok: true, mensaje: 'Transmisión finalizada' });
          return;
        }
        this.logger.error(`❌ [AUDIO-IN] Error en el stream de entrada: ${error.message}`);
        finalize(reject, error);
      });
      audioStream.pipe(ffmpeg.stdin);
    });
  }

  async relayAudioFromDevice(
    res: any,
    targetIp: string,
    deviceId?: string,
  ): Promise<any> {
    const target = await this.resolveAudioNetworkTarget(targetIp, deviceId);
    const baseIsapi = `http://${target.host}:${target.port}/ISAPI/System/TwoWayAudio/channels/${this.audioTalkChannelId}`;

    this.logger.log(`🔊 [AUDIO-OUT] Target resolved: host=${target.host}:${target.port}, user=${target.user}, passLength=${target.pass?.length || 0}`);

    // Limpiar caché de Digest para evitar nonces obsoletos que causen bloqueos 401 en el dispositivo
    const deviceHost = `${target.host}:${target.port}`;
    this.digestChallengeCache.delete(deviceHost);
    this.digestChallengeCache.delete(target.host);

    const isapiHeaders = {
      'Content-Type': 'application/xml',
      'Accept': 'application/xml',
    };

    // 0. Cerrar canal previo que pueda haber quedado abierto (ignorar errores)
    try {
      await this.executeDigestAuth('PUT', `${baseIsapi}/close`, target.user, target.pass, '', 'text', 15000, isapiHeaders);
    } catch {}

    // 1. Detectar codec soportado por el dispositivo (usando caché para comunicación inmediata)
    let audioFormat = 'mulaw'; // default G.711 μ-law
    const cachedCodec = this.deviceCodecCache.get(deviceHost);
    if (cachedCodec) {
      audioFormat = cachedCodec;
      this.logger.log(`[AUDIO-OUT] Dispositivo usa codec cacheado: G.711 ${audioFormat}`);
    } else {
      try {
        const capResult = await this.executeDigestAuth(
          'GET', baseIsapi, target.user, target.pass, null, 'text', 15000, isapiHeaders
        );
        const capText = typeof capResult === 'string' ? capResult : JSON.stringify(capResult);
        if (/G\.711alaw|alaw/i.test(capText)) {
          audioFormat = 'alaw';
        }
        this.deviceCodecCache.set(deviceHost, audioFormat);
        this.logger.log(`[AUDIO-OUT] Codec de dispositivo detectado y cacheado: G.711 ${audioFormat}`);
      } catch (capErr) {
        this.logger.debug(`[AUDIO-OUT] No se pudo detectar codec, usando μ-law por defecto: ${capErr.message}`);
      }
    }

    // 2. Abrir el canal de audio
    const openPayload = `<?xml version="1.0" encoding="UTF-8"?>
<TwoWayAudioChannel version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
  <id>${this.audioTalkChannelId}</id>
  <audioCompressionType>${audioFormat === 'alaw' ? 'G.711alaw' : 'G.711ulaw'}</audioCompressionType>
</TwoWayAudioChannel>`;

    try {
      this.logger.log(`🔊 [AUDIO-OUT] Abriendo canal de audio en ${target.host}:${target.port}`);
      await this.executeDigestAuth('PUT', `${baseIsapi}/open`, target.user, target.pass, openPayload, 'text', 15000, isapiHeaders);
      this.logger.log(`✅ [AUDIO-OUT] Canal de audio abierto correctamente`);
    } catch (openErr) {
      this.logger.error(`❌ [AUDIO-OUT] FALLO al abrir canal de audio: ${openErr.message}`);
      if (!res.headersSent) {
        res.status(502).send(`Error al abrir canal de audio: ${openErr.message}`);
      }
      return;
    }

    const deviceUrl = `${baseIsapi}/audioData`;

    this.logger.log(`[AUDIO-OUT] Solicitando audio de ${target.host}:${target.port} (${target.via})`);

    // 3. Calentar el Digest Auth
    await this.ensureDigestChallenge(deviceUrl, target.user, target.pass);
    let authHeader = this.buildDigestAuthHeader('GET', deviceUrl, target.user, target.pass);
    if (!authHeader) {
      this.logger.warn(`⚠️ [AUDIO-OUT] No hay nonce cached, calentando Digest Auth...`);
      await this.ensureDigestChallenge(`http://${target.host}:${target.port}/ISAPI/System/deviceInfo`, target.user, target.pass);
      await this.ensureDigestChallenge(deviceUrl, target.user, target.pass);
      authHeader = this.buildDigestAuthHeader('GET', deviceUrl, target.user, target.pass);
      if (!authHeader) {
        this.logger.error(`❌ [AUDIO-OUT] No se pudo construir Digest Auth`);
        if (!res.headersSent) {
          res.status(500).send('Error de autenticación con el dispositivo');
        }
        return;
      }
    }

    // 4. ffmpeg: convierte G.711 crudo del dispositivo → MP3 para el navegador
    const ffmpeg = spawn('ffmpeg', [
      '-hide_banner',
      '-loglevel', 'warning',
      '-f', audioFormat,       // mulaw o alaw según detección
      '-ar', '8000',
      '-ac', '1',
      '-i', 'pipe:0',
      '-c:a', 'libmp3lame',
      '-b:a', '64k',
      '-f', 'mp3',
      'pipe:1',
    ]);

    let settled = false;
    const finalize = async () => {
      if (settled) return;
      settled = true;
      try { ffmpeg.stdin.destroy(); } catch {}
      try { ffmpeg.stdout.destroy(); } catch {}
      try { ffmpeg.kill('SIGKILL'); } catch {}

      // Cerrar el canal de audio en el dispositivo
      try {
        this.logger.debug(`[AUDIO-OUT] Cerrando canal de audio en ${target.host}:${target.port}`);
        await this.executeDigestAuth('PUT', `${baseIsapi}/close`, target.user, target.pass, '', 'text', 15000, isapiHeaders);
        this.logger.log(`✅ [AUDIO-OUT] Canal de audio cerrado`);
      } catch (closeErr) {
        this.logger.warn(`⚠️ [AUDIO-OUT] Error al cerrar canal de audio: ${closeErr.message}`);
      }
    };

    // ffmpeg stderr logging
    ffmpeg.stderr.on('data', (chunk) => {
      this.logger.debug(`[AUDIO-OUT] ffmpeg stderr: ${chunk.toString()}`);
    });
    ffmpeg.on('error', (err) => {
      this.logger.error(`❌ [AUDIO-OUT] ffmpeg error: ${err.message}`);
      finalize();
    });

    res.set({
      'Content-Type': 'audio/mpeg',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Access-Control-Allow-Origin': '*',
    });

    res.on('close', () => {
      this.logger.debug(`[AUDIO-OUT] Cliente finalizó conexión, limpiando subprocesos`);
      finalize();
    });

    ffmpeg.stdout.pipe(res);

    // 5. Conectar al stream de audio del dispositivo
    axios
      .request({
        method: 'GET',
        url: deviceUrl,
        headers: {
          Authorization: authHeader,
          'User-Agent': 'PROLISEG-ControlAcceso/1.0',
        },
        responseType: 'stream',
        timeout: 300000,
      })
      .then((response) => {
        this.logger.log(`✅ [AUDIO-OUT] Stream de audio conectado (status ${response.status})`);
        response.data.pipe(ffmpeg.stdin);
        response.data.on('error', (err) => {
          this.logger.error(`[AUDIO-OUT] Error en el stream de la cámara: ${err.message}`);
          finalize();
        });
        response.data.on('end', () => {
          this.logger.debug(`[AUDIO-OUT] Stream de audio del dispositivo terminó`);
          finalize();
        });
      })
      .catch((err) => {
        this.logger.error(`❌ [AUDIO-OUT] Error al conectar con el stream de la cámara: ${err.message}`);
        if (err.response?.status === 401) {
          this.logger.error(`❌ [AUDIO-OUT] Autenticación rechazada (401). Limpiando cache Digest.`);
          const host = new URL(deviceUrl).host;
          this.digestChallengeCache.delete(host);
        }
        finalize();
        if (!res.headersSent) {
          res.status(502).send('Error conectando con la cámara');
        }
      });
  }

  private isVpnIp(ip: string): boolean {
    return /^10\.8\./.test(ip);
  }

  private isPrivateIp(ip: string): boolean {
    return /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(ip);
  }

  private async registrarResultadoPuerta(
    ip: string,
    doorId: number,
    command: 'abrir' | 'cerrar' | 'siempre-abierta' | 'siempre-cerrada',
    deviceId: string | undefined,
    resultado: { ok: boolean; mensaje: string; marca?: string; detalle?: any },
    operator?: any,
  ) {
    if (!resultado.ok) return resultado;

    try {
      let device: any = null;
      if (deviceId) {
        const { data } = await this.supabase
          .getClient()
          .from('dispositivos_iot')
          .select('id, nombre_identificador, ip_direccion')
          .eq('id', deviceId)
          .maybeSingle();
        device = data;
      }

      if (!device) {
        const { data } = await this.supabase
          .getClient()
          .from('dispositivos_iot')
          .select('id, nombre_identificador, ip_direccion')
          .eq('ip_direccion', ip)
          .maybeSingle();
        device = data;
      }

      if (device?.id) {
        const operatorName = operator?.nombre_completo || operator?.name || 'Operador Central';
        const operatorDoc = operator?.cedula || 'CENTRAL';

        this.devicePoller.guardarEventoManual({
          dispositivo_id: device.id,
          nombre_dispositivo: device.nombre_identificador || ip,
          tipo_evento: this.mapDoorCommandToEvent(command),
          metodo_acceso: 'remoto',
          nombre_persona: `Abierto por ${operatorName}`,
          documento_persona: operatorDoc,
          timestamp: new Date().toISOString(),
          detalles_raw: {
            origen: 'comando_backend',
            command,
            doorId,
            marca: resultado.marca,
            mensaje: resultado.mensaje,
            operador: {
              id: operator?.id || null,
              nombre: operatorName,
              cedula: operatorDoc,
            }
          },
        });
      }
    } catch (eventError) {
      this.logger.warn(`⚠️ [PUERTA] Comando ejecutado, pero no se pudo registrar evento: ${eventError.message}`);
    }

    return resultado;
  }

  private mapDoorCommandToEvent(command: string): string {
    if (command === 'abrir' || command === 'siempre-abierta') return 'puerta_abierta';
    if (command === 'cerrar' || command === 'siempre-cerrada') return 'puerta_cerrada';
    return 'cmd_usuario';
  }

  // ─── HIKVISION ────────────────────────────────────────────────────────────

  private async controlPuertaHikvision(
    ip: string, port: number, doorId: number,
    command: string, user: string, pass: string
  ): Promise<{ ok: boolean; mensaje: string; marca: string; detalle?: any }> {
    const base = `http://${ip}:${port}`;
    const endpoint = `${base}/ISAPI/AccessControl/RemoteControl/door/${doorId}`;
    const cmd = this.mapHikvisionDoorCommand(command);
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<RemoteControlDoor version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
  <cmd>${cmd}</cmd>
</RemoteControlDoor>`;

    const response = await this.executeDigestAuthRequest(
      'PUT',
      endpoint,
      user,
      pass,
      body,
      'text',
      10000,
      {
        'Content-Type': 'application/xml',
        'Accept': 'application/xml,text/xml,*/*',
        'If-Modified-Since': '0',
      }
    );

    const parsed = this.parseHikvisionDoorResponse(response.data);
    if (!parsed.ok) {
      throw new Error(`Hikvision rechazo "${command}": ${parsed.message}`);
    }

    this.logger.log(`[HIKVISION] Puerta ${doorId} -> ${cmd} OK en ${ip}:${port}`);
    return {
      ok: true,
      mensaje: `Puerta ${doorId} ejecuto "${command}" correctamente (Hikvision)`,
      marca: 'Hikvision',
      detalle: {
        cmd,
        statusCode: parsed.statusCode,
        statusString: parsed.statusString,
        subStatusCode: parsed.subStatusCode,
        raw: parsed.raw,
      },
    };

    /*
    const auth = { username: user, password: pass };
    const cfg = { auth, timeout: 8000 };

    let url: string;
    let body: string;

    switch (command) {
      case 'abrir':
        // Pulso de apertura: abre la puerta por el tiempo configurado en la cámara
        url = `${base}/ISAPI/AccessControl/door/capabilities`;
        body = `<?xml version="1.0" encoding="UTF-8"?>
<RemoteControlDoor>
  <doorIndex>${doorId}</doorIndex>
  <controlType>open</controlType>
</RemoteControlDoor>`;
        await axios.put(`${base}/ISAPI/AccessControl/RemoteControl/door/${doorId}`, body, {
          ...cfg,
          headers: { 'Content-Type': 'application/xml' }
        });
        this.logger.log(`✅ [HIKVISION] Puerta ${doorId} ABIERTA en ${ip}:${port}`);
        return { ok: true, mensaje: `Puerta ${doorId} abierta correctamente (Hikvision)`, marca: 'Hikvision' };

      case 'cerrar':
        // Forzar cierre (normalState)
        await axios.put(`${base}/ISAPI/AccessControl/RemoteControl/door/${doorId}`,
          `<?xml version="1.0" encoding="UTF-8"?>
<RemoteControlDoor>
  <doorIndex>${doorId}</doorIndex>
  <controlType>close</controlType>
</RemoteControlDoor>`,
          { ...cfg, headers: { 'Content-Type': 'application/xml' } }
        );
        this.logger.log(`✅ [HIKVISION] Puerta ${doorId} CERRADA en ${ip}:${port}`);
        return { ok: true, mensaje: `Puerta ${doorId} cerrada correctamente (Hikvision)`, marca: 'Hikvision' };

      case 'siempre-abierta':
        // Modo Always Open: la puerta permanece abierta hasta nuevo comando
        await axios.put(`${base}/ISAPI/AccessControl/RemoteControl/door/${doorId}`,
          `<?xml version="1.0" encoding="UTF-8"?>
<RemoteControlDoor>
  <doorIndex>${doorId}</doorIndex>
  <controlType>alwaysOpen</controlType>
</RemoteControlDoor>`,
          { ...cfg, headers: { 'Content-Type': 'application/xml' } }
        );
        this.logger.log(`✅ [HIKVISION] Puerta ${doorId} SIEMPRE ABIERTA en ${ip}:${port}`);
        return { ok: true, mensaje: `Puerta ${doorId} en modo SIEMPRE ABIERTA (Hikvision)`, marca: 'Hikvision' };

      case 'siempre-cerrada':
        // Modo Always Closed: bloqueo total, ninguna credencial la abre
        await axios.put(`${base}/ISAPI/AccessControl/RemoteControl/door/${doorId}`,
          `<?xml version="1.0" encoding="UTF-8"?>
<RemoteControlDoor>
  <doorIndex>${doorId}</doorIndex>
  <controlType>alwaysClose</controlType>
</RemoteControlDoor>`,
          { ...cfg, headers: { 'Content-Type': 'application/xml' } }
        );
        this.logger.log(`✅ [HIKVISION] Puerta ${doorId} SIEMPRE CERRADA en ${ip}:${port}`);
        return { ok: true, mensaje: `Puerta ${doorId} en modo SIEMPRE CERRADA (Hikvision)`, marca: 'Hikvision' };

      default:
        throw new Error(`Comando desconocido: ${command}`);
    }
    */
  }

  // ─── DAHUA ────────────────────────────────────────────────────────────────

  private mapHikvisionDoorCommand(command: string): string {
    switch (command) {
      case 'abrir': return 'open';
      case 'cerrar': return 'close';
      case 'siempre-abierta': return 'alwaysOpen';
      case 'siempre-cerrada': return 'alwaysClose';
      default: throw new Error(`Comando desconocido: ${command}`);
    }
  }

  private parseHikvisionDoorResponse(data: any) {
    const raw = typeof data === 'string' ? data : JSON.stringify(data || {});
    const statusCode = this.extractXmlTag(raw, 'statusCode');
    const statusString = this.extractXmlTag(raw, 'statusString');
    const subStatusCode = this.extractXmlTag(raw, 'subStatusCode');
    const errorMsg = this.extractXmlTag(raw, 'errorMsg');
    const normalizedStatus = (statusString || '').toLowerCase();
    const normalizedSubStatus = (subStatusCode || '').toLowerCase();
    const statusOk = !statusCode || statusCode === '0' || statusCode === '1';
    const textOk = normalizedStatus === 'ok' || normalizedSubStatus === 'ok';
    const hasErrorText = /(invalid|error|busy|failed|denied|forbidden)/i.test(raw);

    return {
      ok: statusOk && (textOk || !raw.trim()) && !hasErrorText,
      message: errorMsg || subStatusCode || statusString || raw || 'Respuesta vacia del dispositivo',
      statusCode,
      statusString,
      subStatusCode,
      raw,
    };
  }

  private extractXmlTag(xml: string, tag: string): string | undefined {
    const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i'));
    return match?.[1]?.trim();
  }

  private async controlPuertaDahua(
    ip: string, port: number, doorId: number,
    command: string, user: string, pass: string
  ): Promise<{ ok: boolean; mensaje: string; marca: string; detalle?: any }> {
    const base = `http://${ip}:${port}`;
    const auth = { username: user, password: pass };
    const cfg = { auth, timeout: 8000 };

    // Dahua usa la API CGI  /cgi-bin/accessControl.cgi
    let action: string;
    switch (command) {
      case 'abrir':           action = 'openDoor';       break;
      case 'cerrar':          action = 'closeDoor';      break;
      case 'siempre-abierta': action = 'alwaysOpenDoor'; break;
      case 'siempre-cerrada': action = 'alwaysCloseDoor'; break;
      default: throw new Error(`Comando desconocido: ${command}`);
    }

    const url = `${base}/cgi-bin/accessControl.cgi?action=${action}&channel=${doorId}`;
    const resp = await axios.get(url, cfg);

    if (String(resp.data).includes('OK') || resp.status === 200) {
      this.logger.log(`✅ [DAHUA] Puerta ${doorId} → ${command} en ${ip}:${port}`);
      return { ok: true, mensaje: `Puerta ${doorId} ejecutó "${command}" correctamente (Dahua)`, marca: 'Dahua' };
    }

    throw new Error(`Respuesta inesperada de Dahua: ${resp.data}`);
  }



  async findAllPersonas(opts: { dispositivoId?: string } = {}) {
    let personaIds: string[] | null = null;

    if (opts.dispositivoId) {
      const { data: permisos, error: permisosError } = await this.supabase
        .getClient()
        .from('acceso_permisos_dispositivos')
        .select('persona_id')
        .eq('dispositivo_id', opts.dispositivoId)
        .eq('activo', true);

      if (permisosError) throw permisosError;
      personaIds = (permisos || []).map((permiso: any) => permiso.persona_id).filter(Boolean);
      if (!personaIds.length) return [];
    }

    let query = this.supabase
      .getClient()
      .from('personas_gestion_acceso')
      .select('*')
      .order('nombre_completo', { ascending: true });

    if (personaIds) query = query.in('id', personaIds);

    const { data, error } = await query;
    if (error) throw error;
    return this.attachFotosPersonas(data || []);
  }

  async createPersona(dto: CreatePersonaAccesoDto) {
    const { dispositivos_ids, foto_base64, ...personaInput } = dto as any;
    const documento = String(personaInput.documento_identidad || '').trim();

    if (!documento) {
      throw new Error('documento_identidad es obligatorio');
    }

    const personaData: any = {
      entidad_tipo: personaInput.entidad_tipo || 'otro',
      entidad_id: personaInput.entidad_id || null,
      nombre_completo: personaInput.nombre_completo,
      documento_identidad: documento,
      lista_estado: personaInput.lista_estado || 'blanca',
      motivo_restriccion: personaInput.motivo_restriccion || null,
      face_id_ref: personaInput.face_id_ref || documento,
      codigo_tarjeta: personaInput.codigo_tarjeta || null,
      pin_seguridad: personaInput.pin_seguridad || null,
      activo: personaInput.activo ?? true,
    };

    // 1. Crear o actualizar persona
    const { data: persona, error: pError } = await this.supabase
      .getSupabaseAdminClient()
      .from('personas_gestion_acceso')
      .upsert([personaData], { onConflict: 'documento_identidad' })
      .select()
      .single();

    if (pError) throw pError;

    // 2. Vincular con dispositivos si existen
    if (dispositivos_ids && dispositivos_ids.length > 0) {
      await this.vincularPersonaDispositivos(persona.id, dispositivos_ids);
    }

    // 3. Guardar rostro capturado si vino desde el frontend
    if (foto_base64) {
      await this.guardarFotoPersona(persona.id, foto_base64).catch((error) => {
        this.logger.warn(`⚠️ [PERSONA] No se pudo guardar foto facial: ${error.message}`);
      });
    }

    const [personaConFoto] = await this.attachFotosPersonas([persona]);
    return personaConFoto || persona;
  }

  async updatePersona(id: string, body: any) {
    const admin = this.supabase.getSupabaseAdminClient();

    // 1. Obtener la persona actual antes de la actualización
    const { data: persona, error: pErr } = await admin
      .from('personas_gestion_acceso')
      .select('*')
      .eq('id', id)
      .single();

    if (pErr || !persona) {
      throw new Error(`Persona no encontrada: ${pErr?.message}`);
    }

    // 2. Actualizar en la base de datos
    const { data: updatedPersona, error: uErr } = await admin
      .from('personas_gestion_acceso')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (uErr) throw uErr;

    // 3. Si se cambia el estado "activo", sincronizar con los dispositivos vinculados
    if (body.activo !== undefined && body.activo !== persona.activo) {
      const { data: permisos } = await admin
        .from('acceso_permisos_dispositivos')
        .select('*, dispositivo:dispositivos_iot(*)')
        .eq('persona_id', id);

      for (const p of permisos || []) {
        const ip = p.dispositivo?.ip_direccion;
        if (ip) {
          try {
            if (body.activo === false) {
              // Si se desactiva, lo quitamos físicamente del chip del hardware
              await this.eliminarUsuarioDeHardware(ip, persona.documento_identidad);
              this.logger.log(`👤 [HARDWARE SYNC] Acceso DESACTIVADO: Eliminado usuario ${persona.documento_identidad} de dispositivo ${ip}`);
            } else if (body.activo === true) {
              // Si se activa, lo volvemos a empujar al chip del hardware
              await this.pushPersonaToDevice(id, p.dispositivo_id);
              this.logger.log(`👤 [HARDWARE SYNC] Acceso ACTIVADO: Empujado usuario ${persona.documento_identidad} a dispositivo ${ip}`);
            }
          } catch (err) {
            this.logger.warn(`⚠️ [HARDWARE SYNC] Error al sincronizar estado activo de persona en ${ip}: ${err.message}`);
          }
        }
      }
    }

    return updatedPersona;
  }

  /**
   * PROXY METHODS (HARDWARE ADVANCED)
   */

  /**
   * Verificar estado en línea (ping ISAPI rápido)
   */
  async checkDeviceOnlineStatus(ip: string): Promise<boolean> {
    try {
      await this.proxyRequestDynamic(ip, 'get', '/ISAPI/System/deviceInfo', null, { customTimeout: 3000 });
      return true;
    } catch (e) {
      return false;
    }
  }




  private async resolveRtspNetworkTarget(dev: any): Promise<{ ip: string; port: number; via: string }> {
    const config = dev?.configuracion_tecnica || {};
    const mapped = config?.puertos_mapeados || {};
    const ip = dev?.ip_direccion;
    const mappedRtsp = Number(mapped?.mapped_rtsp || 0);
    const configuredRtsp = Number(
      config?.puerto_rtsp
      || mapped?.original_rtsp
      || config?.puerto_rtsp_original
      || 554
    );

    if (this.isVpnIp(ip)) {
      return { ip, port: mappedRtsp || configuredRtsp || 554, via: 'vpn' };
    }

    if (mappedRtsp) {
      const { data: servers } = await this.supabase
        .getClient()
        .from('control_acceso_servidores_mikrotik')
        .select('ip_publica')
        .limit(1);

      const publicIp = servers?.[0]?.ip_publica;
      if (publicIp) {
        return { ip: publicIp, port: mappedRtsp, via: 'mikrotik-nat' };
      }

      return { ip, port: mappedRtsp, via: 'mapped-rtsp' };
    }

    if (this.isPrivateIp(ip)) {
      const { data: servers } = await this.supabase
        .getClient()
        .from('control_acceso_servidores_mikrotik')
        .select('ip_publica')
        .limit(1);

      const publicIp = servers?.[0]?.ip_publica;
      if (publicIp) {
        const lastOctet = Number(ip.split('.').pop() || '554');
        return { ip: publicIp, port: 30000 + lastOctet, via: 'mikrotik-nat' };
      }
    }

    return { ip, port: Number(configuredRtsp || 554), via: 'directo' };
  }

  async startVideoStream(deviceId: string): Promise<any> {
    try {
      // 1. Obtener datos del dispositivo
      const { data: devices, error: dbErr } = await this.supabase
        .getClient()
        .from('dispositivos_iot')
        .select('*')
        .eq('id', deviceId);

      if (dbErr || !devices || devices.length === 0) {
        throw new Error('Dispositivo no encontrado');
      }

      const dev = devices[0];
      
      // Si el equipo está marcado como "sin cámara" en su configuración técnica
      if (dev.configuracion_tecnica?.sin_camara || dev.configuracion_tecnica?.sin_video || dev.configuracion_tecnica?.no_camera) {
        this.logger.log(`ℹ️ [WEBRTC] Dispositivo ${deviceId} configurado sin cámara. Retornando bandera sin_camara.`);
        return {
          sinCamara: true,
          nombrePuesto: dev.nombre_identificador || dev.nombre || 'Control de Acceso'
        };
      }

      const user = dev.credencial_usuario || 'admin';
      const pass = dev.credencial_password || 'proliseg#123';
      const rtspTarget = await this.resolveRtspNetworkTarget(dev);
      const targetIp = rtspTarget.ip;
      const rtspPort = rtspTarget.port;

      // Detectar la marca para armar la URL RTSP correcta (Sub-Stream)
      const marca = dev.configuracion_tecnica?.marca?.toLowerCase() || 'hikvision';
      let rtspPath = '/Streaming/Channels/102'; // Default: Hikvision Sub-Stream

      if (marca === 'dahua') {
        rtspPath = '/cam/realmonitor?channel=1&subtype=1'; // Dahua Sub-Stream
      } else if (marca === 'zkteco' || marca === 'zk') {
        rtspPath = '/live/ch01_1'; // ZKTeco Sub-Stream
      }

      // Armar la URL de la fuente RTSP (EncodeURIComponent para contraseñas con caracteres especiales como #)
      const encodedPass = encodeURIComponent(pass);
      const sourceUrl = `rtsp://${user}:${encodedPass}@${targetIp}:${rtspPort}${rtspPath}`;
      this.logger.log(`[WEBRTC] Fuente RTSP ${deviceId}: ${targetIp}:${rtspPort}${rtspPath} via ${rtspTarget.via}`);

      // Nombre simple de la cámara sin slashes para evitar errores 404 en la API
      const streamName = `cam_${deviceId.substring(0, 8)}`;

      // 2. Registrar la ruta en la API de MediaMTX mediante el proxy seguro de Traefik
      const domain = 'servidor.proliseg.com';
      const apiAuth = { username: 'admin', password: 'proliseg1025' };

      // Leer valores personalizados desde configuracion_tecnica (con fallbacks estables)
      const isVpn = this.isVpnIp(targetIp);
      const sourceOnDemand = dev.configuracion_tecnica?.source_on_demand ?? (isVpn ? false : true);
      const rtspTransport = dev.configuracion_tecnica?.rtsp_transport || 'tcp';

      const pathPayload = {
        source: sourceUrl,
        sourceOnDemand: sourceOnDemand,
        rtspTransport: rtspTransport,
      };

      try {
        // Intentar crear la ruta nueva
        await axios.post(`https://${domain}/webrtc-api/v3/config/paths/add/${streamName}`, pathPayload, { auth: apiAuth });
        this.logger.log(`✅ [WEBRTC] Ruta ${streamName} creada en MediaMTX.`);
      } catch (err) {
        if (err.response?.status === 400) {
          // La ruta YA EXISTE → usar PATCH para actualizarla sin borrarla
          try {
            await axios.patch(`https://${domain}/webrtc-api/v3/config/paths/patch/${streamName}`, pathPayload, { auth: apiAuth });
            this.logger.log(`🔄 [WEBRTC] Ruta ${streamName} actualizada (PATCH) en MediaMTX.`);
          } catch (patchErr) {
            this.logger.warn(`⚠️ [WEBRTC] Error actualizando ruta en MediaMTX (PATCH): ${patchErr.message}`);
          }
        } else {
          this.logger.warn(`⚠️ [WEBRTC] Error registrando ruta en MediaMTX: ${err.message}`);
        }
      }

      // Retornar las rutas con el prefijo /webrtc/ que maneja el frontend y el iframe
      return {
        streamName,
        webrtcUrl: `https://${domain}/webrtc/${streamName}`,
        iframeUrl: `https://${domain}/webrtc/${streamName}/` // El slash final es vital
      };
    } catch (error) {
      this.logger.error(`❌ [WEBRTC STREAM] Error: ${error.message}`);
      throw error;
    }
  }

  async getSnapshot(ip: string, id?: string): Promise<Buffer> {
    let user = 'admin';
    let pass = 'proliseg#123';
    let port = 80;
    let targetIp = ip;

    try {
      // 1. Consultar base de datos Supabase para recuperar credenciales y puerto real del biométrico
      let query = this.supabase.getClient().from('dispositivos_iot').select('*');
      if (id) {
        query = query.eq('id', id);
      } else {
        query = query.eq('ip_direccion', ip);
      }

      const { data: devices, error: dbErr } = await query;
      if (!dbErr && devices && devices.length > 0) {
        const dev = devices[0];
        user = dev.credencial_usuario || 'admin';
        pass = dev.credencial_password || '';
        port = dev.configuracion_tecnica?.puerto || dev.puerto_servicio || 80;
        targetIp = dev.ip_direccion || ip;
      }
    } catch (dbErr) {
      this.logger.warn(`⚠️ [SNAPSHOT DB WARN] No se pudo obtener credenciales: ${dbErr.message}. Usando fallbacks.`);
    }

    // Si la IP es de WireGuard (ej. 10.8.0.x), conectamos DIRECTO por el túnel sin hacer NAT.
    const isWireguardIp = targetIp.startsWith('10.8.');

    // Auto-resolución de IPs privadas locales (solo si no es WireGuard)
    const isPrivate = /^(192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(targetIp) || (targetIp.startsWith('10.') && !isWireguardIp);

    if (isPrivate) {
      try {
        const { data: servers } = await this.supabase
          .getClient()
          .from('control_acceso_servidores_mikrotik')
          .select('*')
          .limit(1);

        if (servers && servers.length > 0) {
          const srv = servers[0];
          const lastOctet = targetIp.split('.').pop();
          const mappedPort = 10000 + Number(lastOctet || '80');

          this.logger.log(`🔧 [AUTO-NAT] Creando/Verificando regla NAT en MikroTik ${srv.ip_publica} para snapshot de ${targetIp} al puerto ${mappedPort}...`);

          await this.addMikrotikNatRule(
            srv.ip_publica,
            targetIp,
            mappedPort,
            srv.usuario,
            srv.password,
            String(srv.puerto_rest || 4433)
          );

          targetIp = srv.ip_publica;
          port = mappedPort;
        }
      } catch (err) {
        this.logger.error(`❌ [AUTO-NAT ERROR] No se pudo auto-mapear NAT para snapshot: ${err.message}`);
      }
    }

    const path = `/ISAPI/Streaming/channels/1/picture`;
    try {
      // 2. Ejecutar petición directa ISAPI usando Digest Auth en la IP resuelta
      const response = await this.executeDigestAuth('GET', `http://${targetIp}:${port}${path}`, user, pass, null, 'arraybuffer');
      return response;
    } catch (error) {
      this.logger.error(`❌ [SNAPSHOT] Error: ${error.message} - Dest: ${targetIp}:${port}`);
      throw error;
    }
  }

  async syncUsuariosHardware(input: string | { ip?: string; deviceId?: string; includePhotos?: boolean }): Promise<any> {
    const params = typeof input === 'string' ? { ip: input } : input;
    const device = await this.resolveDeviceForSync(params);
    if (!device?.ip_direccion) {
      throw new Error('No se encontró el dispositivo para sincronizar');
    }

    const ip = device.ip_direccion;
    const raw = await this.buscarUsuariosHardware(ip, device.id);
    const usuarios = this.extractHardwareUsers(raw);
    const resultados: any[] = [];

    for (const usuario of usuarios) {
      const normalized = this.normalizeHardwareUser(usuario, device);
      if (!normalized.documento_identidad || !normalized.nombre_completo) continue;

      const { dispositivos_ids, foto_origen, raw_user, ...personaData } = normalized;
      const { data: persona, error } = await this.supabase
        .getSupabaseAdminClient()
        .from('personas_gestion_acceso')
        .upsert([personaData], { onConflict: 'documento_identidad' })
        .select()
        .single();

      if (error) {
        resultados.push({ ok: false, usuario: normalized, error: error.message });
        continue;
      }

      await this.vincularPersonaDispositivos(persona.id, dispositivos_ids);

      let foto_rostro_url: string | null = null;
      if (params.includePhotos !== false) {
        foto_rostro_url = await this.syncFotoHardwarePersona(device, persona.id, foto_origen, raw_user)
          .catch((photoError) => {
            this.logger.warn(`⚠️ [SYNC] Foto no sincronizada para ${persona.documento_identidad}: ${photoError.message}`);
            return null;
          });
      }

      resultados.push({
        ok: true,
        persona_id: persona.id,
        nombre_completo: persona.nombre_completo,
        documento_identidad: persona.documento_identidad,
        foto_rostro_url,
      });
    }

    return {
      dispositivo_id: device.id,
      dispositivo: device.nombre_identificador,
      total_hardware: usuarios.length,
      total_sincronizados: resultados.filter((item: any) => item.ok).length,
      errores: resultados.filter((item: any) => !item.ok),
      personas: resultados.filter((item: any) => item.ok),
      raw,
    };
  }

  private async resolveDeviceForSync(params: { ip?: string; deviceId?: string }) {
    let query = this.supabase
      .getClient()
      .from('dispositivos_iot')
      .select('*');

    if (params.deviceId) query = query.eq('id', params.deviceId);
    else if (params.ip) query = query.eq('ip_direccion', params.ip);
    else throw new Error('Debe enviar ip o deviceId');

    const { data, error } = await query.maybeSingle();
    if (error) throw error;

    if (data) return data;
    if (params.ip) return { id: null, ip_direccion: params.ip, nombre_identificador: params.ip };
    return null;
  }

  private async buscarUsuariosHardware(ip: string, deviceId?: string): Promise<any> {
    let allUsers: any[] = [];
    let position = 0;
    const maxResults = 100;
    let totalMatches = 0;
    const searchId = `sync_${Date.now()}`;

    do {
      const body = {
        UserInfoSearchCond: {
          searchID: searchId,
          searchResultPosition: position,
          maxResults: maxResults,
        },
      };

      try {
        const response = await this.proxyRequestDynamic(
          ip,
          'post',
          '/ISAPI/AccessControl/UserInfo/Search?format=json',
          body,
          { customTimeout: 30000, deviceId }
        );

        const usersList = this.extractHardwareUsers(response);
        if (!usersList.length) {
          break;
        }
        allUsers = allUsers.concat(usersList);

        const currentMatches = response?.UserInfoSearch?.numOfMatches || response?.numOfMatches || usersList.length;
        totalMatches = response?.UserInfoSearch?.totalMatches || response?.totalMatches || 0;

        // Condición de parada robusta: última página o se alcanzó el total informado
        if (usersList.length < maxResults || (totalMatches > 0 && allUsers.length >= totalMatches) || currentMatches === 0) {
          break;
        }

        position += currentMatches;
      } catch (error) {
        this.logger.warn(`⚠️ [SYNC] POST UserInfo/Search falló en posición ${position}: ${error.message}`);
        if (position === 0) {
          try {
            const response = await this.proxyRequestDynamic(
              ip,
              'get',
              '/ISAPI/AccessControl/UserInfo/Search?format=json',
              null,
              { customTimeout: 30000, deviceId }
            );
            return response;
          } catch (getErr) {
            this.logger.error(`❌ [SYNC] GET UserInfo/Search falló también: ${getErr.message}`);
            throw getErr;
          }
        }
        break;
      }
    } while (allUsers.length < totalMatches);

    return {
      UserInfoSearch: {
        searchID: searchId,
        responseStatusStrg: 'OK',
        numOfMatches: allUsers.length,
        totalMatches: allUsers.length,
        UserInfo: allUsers,
      }
    };
  }

  private extractHardwareUsers(raw: any): any[] {
    const candidates = [
      raw?.UserInfoSearch?.UserInfo,
      raw?.UserInfo,
      raw?.users,
      raw?.data,
      raw,
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate;
    }

    return [];
  }

  private normalizeHardwareUser(user: any, device: any) {
    const documento = this.firstText(
      user?.employeeNoString,
      user?.employeeNo,
      user?.EmployeeNo,
      user?.userID,
      user?.UserID,
      user?.personId,
      user?.FPID,
      user?.cardNo,
      user?.CardNo,
    );
    const nombre = this.firstText(user?.name, user?.Name, user?.userName, user?.employeeName, user?.fullName);
    const cardNo = this.firstText(user?.cardNo, user?.CardNo, user?.cardNumber, user?.Cards?.[0]?.cardNo);
    const faceId = this.firstText(user?.FPID, user?.faceId, user?.faceID, documento);

    return {
      entidad_tipo: 'otro',
      entidad_id: null,
      nombre_completo: nombre || `Usuario ${documento}`,
      documento_identidad: documento,
      lista_estado: 'blanca',
      motivo_restriccion: null,
      face_id_ref: faceId || documento,
      codigo_tarjeta: cardNo || null,
      pin_seguridad: this.firstText(user?.password, user?.pin, user?.pin_seguridad) || null,
      activo: user?.enable !== false && user?.Enabled !== false,
      dispositivos_ids: device?.id ? [device.id] : [],
      foto_origen: this.firstText(
        user?.faceURL,
        user?.FaceURL,
        user?.pictureURL,
        user?.photoURL,
        user?.imageURL,
        user?.faceData,
        user?.photoBase64,
      ),
      raw_user: user,
    };
  }

  private async vincularPersonaDispositivos(personaId: string, dispositivosIds: string[]) {
    const uniqueIds = Array.from(new Set((dispositivosIds || []).filter(Boolean)));
    if (!uniqueIds.length) return;

    const admin = this.supabase.getSupabaseAdminClient();
    for (const dispositivoId of uniqueIds) {
      const { data: existing } = await admin
        .from('acceso_permisos_dispositivos')
        .select('id')
        .eq('persona_id', personaId)
        .eq('dispositivo_id', dispositivoId)
        .maybeSingle();

      if (existing?.id) {
        await admin
          .from('acceso_permisos_dispositivos')
          .update({ activo: true })
          .eq('id', existing.id);
      } else {
        await admin
          .from('acceso_permisos_dispositivos')
          .insert({ persona_id: personaId, dispositivo_id: dispositivoId, activo: true });
      }
    }
  }

  private async syncFotoHardwarePersona(device: any, personaId: string, fotoOrigen: string | null, rawUser: any): Promise<string | null> {
    const directBase64 = this.firstText(
      fotoOrigen?.startsWith('data:image/') ? fotoOrigen : null,
      rawUser?.faceData,
      rawUser?.photoBase64,
      rawUser?.imageBase64,
    );
    if (directBase64) return this.guardarFotoPersona(personaId, directBase64);

    const urlOrPath = this.firstText(fotoOrigen, rawUser?.faceURL, rawUser?.pictureURL, rawUser?.photoURL);
    if (!urlOrPath) return null;

    const buffer = await this.descargarFotoHardware(device.ip_direccion, urlOrPath);
    return this.guardarFotoPersona(personaId, buffer);
  }

  private async descargarFotoHardware(ip: string, urlOrPath: string): Promise<Buffer> {
    let path = urlOrPath;
    if (/^https?:\/\//i.test(urlOrPath)) {
      const parsed = new URL(urlOrPath);
      path = `${parsed.pathname}${parsed.search}`;
    }

    const response = await this.proxyRequestDynamic(ip, 'get', path, null, {
      responseType: 'arraybuffer',
      customTimeout: 20000,
    });

    return Buffer.isBuffer(response) ? response : Buffer.from(response);
  }

  private async guardarFotoPersona(personaId: string, foto: string | Buffer): Promise<string> {
    let buffer: Buffer;
    let extension = 'jpg';
    let contentType = 'image/jpeg';

    if (Buffer.isBuffer(foto)) {
      buffer = foto;
    } else {
      const match = String(foto).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      const base64 = match ? match[2] : String(foto);
      contentType = match?.[1] || contentType;
      extension = contentType.includes('png') ? 'png' : 'jpg';
      buffer = Buffer.from(base64, 'base64');
    }

    const filePath = `personas/${personaId}/${Date.now()}.${extension}`;
    const admin = this.supabase.getSupabaseAdminClient();
    const { error } = await admin
      .storage
      .from('control-acceso-faces')
      .upload(filePath, buffer, { upsert: true, contentType });

    if (error) throw error;

    const { data: publicUrl } = admin.storage.from('control-acceso-faces').getPublicUrl(filePath);
    const fotoUrl = publicUrl?.publicUrl || filePath;

    await admin
      .from('biometria_facial')
      .insert({
        persona_id: personaId,
        foto_url_storage: fotoUrl,
        sincronizado_en_biometrico: true,
      });

    return fotoUrl;
  }

  private async attachFotosPersonas(rows: any[]): Promise<any[]> {
    const personaIds = Array.from(new Set(
      rows
        .map((row: any) => row?.persona_id || row?.id || row?.persona?.id)
        .filter(Boolean)
    ));

    if (!personaIds.length) return rows;

    const { data: fotos } = await this.supabase
      .getClient()
      .from('biometria_facial')
      .select('persona_id, foto_url_storage, fecha_captura')
      .in('persona_id', personaIds)
      .order('fecha_captura', { ascending: false });

    const byPersona = new Map<string, string>();
    for (const foto of fotos || []) {
      if (!byPersona.has(foto.persona_id)) byPersona.set(foto.persona_id, foto.foto_url_storage);
    }

    return rows.map((row: any) => {
      const personaId = row?.persona_id || row?.id || row?.persona?.id;
      const foto = personaId ? byPersona.get(personaId) : null;
      if (row?.persona) {
        return {
          ...row,
          persona: {
            ...row.persona,
            foto_rostro_url: foto || row.persona.foto_rostro_url || null,
          },
        };
      }
      return {
        ...row,
        foto_rostro_url: foto || row.foto_rostro_url || null,
      };
    });
  }

  private firstText(...values: any[]): string | null {
    for (const value of values) {
      if (value === undefined || value === null) continue;
      const text = String(value).trim();
      if (text) return text;
    }
    return null;
  }

  async scanNetwork(
    range: string,
    mikrotikOpts?: { mikrotikIp?: string, mikrotikUser?: string, mikrotikPass?: string, mikrotikPort?: string }
  ): Promise<any[]> {
    if (mikrotikOpts?.mikrotikIp) {
      this.logger.log(`🔍 [SCAN NETWORK] Iniciando escaneo de red vía MikroTik REST API en IP: ${mikrotikOpts.mikrotikIp}`);
      return this.scanViaMikrotik(
        mikrotikOpts.mikrotikIp,
        mikrotikOpts.mikrotikUser,
        mikrotikOpts.mikrotikPass,
        mikrotikOpts.mikrotikPort
      );
    }

    const url = `${this.proxyUrl}/scan?range=${range}`;
    try {
      const response = await axios.get(url, {
        headers: { 'X-API-Key': this.apiKey },
        timeout: 60000
      });
      return response.data;
    } catch (error) {
      this.logger.error(`❌ [SCAN ERROR]: ${error.message}`);
      return [];
    }
  }

  async scanViaMikrotik(ip: string, user?: string, pass?: string, port?: string): Promise<any[]> {
    const username = user || 'admin';
    const password = pass || '';
    const portNum = port || '80';

    const protocols = ['https', 'http'];
    let errorMsg = '';

    const httpsAgent = new (require('https').Agent)({ rejectUnauthorized: false });

    for (const protocol of protocols) {
      const url = `${protocol}://${ip}:${portNum}/rest/ip/dhcp-server/lease`;
      this.logger.log(`🔍 [MIKROTIK REST API] Conectando a ${url}...`);

      try {
        const response = await axios.get(url, {
          auth: { username, password },
          httpsAgent,
          timeout: 12000,
          headers: {
            'User-Agent': 'curl/7.74.0',
            'Accept': '*/*'
          }
        });

        const leases = response.data || [];
        this.logger.log(`✅ [MIKROTIK REST API] Se obtuvieron ${leases.length} registros DHCP.`);

        let arpEntries = [];
        try {
          const arpUrl = `${protocol}://${ip}:${portNum}/rest/ip/arp`;
          const arpResponse = await axios.get(arpUrl, {
            auth: { username, password },
            httpsAgent,
            timeout: 5000,
            headers: {
              'User-Agent': 'curl/7.74.0',
              'Accept': '*/*'
            }
          });
          arpEntries = arpResponse.data || [];
        } catch (arpErr) {
          this.logger.warn(`⚠️ [MIKROTIK REST API] No se pudo obtener la tabla ARP: ${arpErr.message}`);
        }

        let pppActive = [];
        try {
          const pppUrl = `${protocol}://${ip}:${portNum}/rest/ppp/active`;
          const pppResponse = await axios.get(pppUrl, {
            auth: { username, password },
            httpsAgent,
            timeout: 5000,
            headers: {
              'User-Agent': 'curl/7.74.0',
              'Accept': '*/*'
            }
          });
          pppActive = pppResponse.data || [];
          this.logger.log(`✅ [MIKROTIK REST API] Se obtuvieron ${pppActive.length} túneles PPP activos.`);
        } catch (pppErr) {
          this.logger.warn(`⚠️ [MIKROTIK REST API] No se pudo obtener la tabla PPP activa: ${pppErr.message}`);
        }

        let neighbors = [];
        try {
          const neighborsUrl = `${protocol}://${ip}:${portNum}/rest/ip/neighbor`;
          const neighborsResponse = await axios.get(neighborsUrl, {
            auth: { username, password },
            httpsAgent,
            timeout: 5000,
            headers: {
              'User-Agent': 'curl/7.74.0',
              'Accept': '*/*'
            }
          });
          neighbors = neighborsResponse.data || [];
          this.logger.log(`✅ [MIKROTIK REST API] Se obtuvieron ${neighbors.length} vecinos de red (neighbors).`);
        } catch (neighErr) {
          this.logger.warn(`⚠️ [MIKROTIK REST API] No se pudo obtener la tabla de vecinos: ${neighErr.message}`);
        }

        const deviceMap = new Map<string, any>();

        leases.forEach((lease: any) => {
          const address = lease.address;
          const mac = lease['mac-address'] || '';
          const hostname = lease['host-name'] || lease['active-hostname'] || '';
          const status = lease.status || '';
          const comment = lease.comment || '';

          if (address) {
            const isHikvision = mac.toLowerCase().startsWith('a4:14:37') ||
              mac.toLowerCase().startsWith('bc:ad:28') ||
              mac.toLowerCase().startsWith('44:55:c4') ||
              mac.toLowerCase().startsWith('fc:3f:db') ||
              mac.toLowerCase().startsWith('00:40:3d') ||
              mac.toLowerCase().startsWith('84:25:3f') ||
              mac.toLowerCase().startsWith('e0:50:8b') ||
              hostname.toLowerCase().includes('hik') ||
              hostname.toLowerCase().includes('camera') ||
              hostname.toLowerCase().includes('vms') ||
              hostname.toLowerCase().includes('acceso') ||
              hostname.toLowerCase().includes('face') ||
              hostname.toLowerCase().includes('terminal');

            deviceMap.set(address, {
              ip: address,
              mac: mac,
              hostname: hostname || comment || 'Dispositivo en MikroTik',
              status: status === 'bound' ? 'Online' : 'Offline',
              hasAccessControl: isHikvision,
              vendor: isHikvision ? 'Hikvision' : 'Genérico'
            });
          }
        });

        arpEntries.forEach((arp: any) => {
          const address = arp.address;
          const mac = arp['mac-address'] || '';
          if (address && !deviceMap.has(address)) {
            const isHikvision = mac.toLowerCase().startsWith('a4:14:37') ||
              mac.toLowerCase().startsWith('bc:ad:28') ||
              mac.toLowerCase().startsWith('44:55:c4') ||
              mac.toLowerCase().startsWith('fc:3f:db') ||
              mac.toLowerCase().startsWith('00:40:3d') ||
              mac.toLowerCase().startsWith('84:25:3f') ||
              mac.toLowerCase().startsWith('e0:50:8b');
            deviceMap.set(address, {
              ip: address,
              mac: mac,
              hostname: isHikvision ? 'Terminal de Acceso Hikvision (ARP)' : 'Dispositivo Activo (ARP)',
              status: 'Online',
              hasAccessControl: isHikvision,
              vendor: isHikvision ? 'Hikvision' : 'Genérico'
            });
          }
        });

        pppActive.forEach((ppp: any) => {
          const address = ppp.address;
          const callerId = ppp['caller-id'] || '';
          const name = ppp.name || '';
          const service = ppp.service || 'VPN';

          if (address && !deviceMap.has(address)) {
            deviceMap.set(address, {
              ip: address,
              mac: `TÚNEL (${service})`,
              hostname: `Túnel VPN: ${name} (${callerId})`,
              status: 'Online',
              hasAccessControl: true, // Permitir escaneo y vinculación directa
              vendor: 'MikroTik Túnel'
            });
          }
        });

        neighbors.forEach((neigh: any) => {
          const address = neigh.address;
          const mac = neigh['mac-address'] || '';
          const identity = neigh.identity || neigh.board || 'Dispositivo Vecino';
          const iface = neigh.interface || '';

          if (address && !deviceMap.has(address)) {
            const isHikvision = mac.toLowerCase().startsWith('a4:14:37') ||
              mac.toLowerCase().startsWith('bc:ad:28') ||
              mac.toLowerCase().startsWith('44:55:c4') ||
              mac.toLowerCase().startsWith('fc:3f:db') ||
              mac.toLowerCase().startsWith('00:40:3d') ||
              mac.toLowerCase().startsWith('84:25:3f') ||
              mac.toLowerCase().startsWith('e0:50:8b') ||
              identity.toLowerCase().includes('hik') ||
              identity.toLowerCase().includes('camera') ||
              identity.toLowerCase().includes('vms') ||
              identity.toLowerCase().includes('acceso') ||
              identity.toLowerCase().includes('face') ||
              identity.toLowerCase().includes('terminal');

            deviceMap.set(address, {
              ip: address,
              mac: mac || `TÚNEL (${iface})`,
              hostname: `Vecino: ${identity} [Int: ${iface}]`,
              status: 'Online',
              hasAccessControl: isHikvision,
              vendor: isHikvision ? 'Hikvision' : (neigh.board || 'Genérico')
            });
          }
        });

        return Array.from(deviceMap.values());

      } catch (err) {
        errorMsg = err.message;
        this.logger.error(`❌ [MIKROTIK REST ERROR] (${protocol}): ${err.message}`);
      }
    }

    throw new Error(`Error al conectar con la REST API de MikroTik: ${errorMsg}`);
  }

  async addMikrotikNatRule(
    mikrotikIp: string,
    deviceLocalIp: string,
    publicPort: number,
    user?: string,
    pass?: string,
    port?: string,
    targetLocalPort: string = '80',
    protocolType: string = 'tcp'
  ): Promise<number> {
    const username = user || 'admin';
    const password = pass || '';
    const portNum = port || '80';

    const protocols = ['https', 'http'];
    let errorMsg = '';

    const httpsAgent = new (require('https').Agent)({ rejectUnauthorized: false });

    for (const protocol of protocols) {
      const url = `${protocol}://${mikrotikIp}:${portNum}/rest/ip/firewall/nat`;

      try {
        const checkResponse = await axios.get(url, {
          auth: { username, password },
          httpsAgent,
          timeout: 6000,
          headers: {
            'User-Agent': 'curl/7.74.0',
            'Accept': '*/*',
            'Content-Type': 'application/json'
          }
        });

        const existingRules = checkResponse.data || [];

        // 1. REUTILIZACIÓN DE REGLAS: Si ya existe una regla para esta IP, reutilizar el puerto existente sin duplicar
        const existingRule = existingRules.find((rule: any) =>
          rule['to-addresses'] === deviceLocalIp && rule['to-ports'] === targetLocalPort
        );

        // Asegurar automáticamente que exista la regla de retorno (masquerade) para evitar problemas de túnel y rutas asimétricas
        await this.ensureMasqueradeRule(url, deviceLocalIp, username, password, httpsAgent, existingRules, targetLocalPort);

        if (existingRule) {
          const activePort = Number(existingRule['dst-port'] || publicPort);
          this.logger.log(`ℹ️ [NAT RULE REUSE] Reutilizando regla NAT existente en MikroTik para ${deviceLocalIp} -> puerto ${activePort}`);
          return activePort;
        }

        // 2. RESOLUCIÓN DE CONFLICTOS: Si el puerto objetivo está ocupado por otra IP, eliminar la regla conflictiva vieja
        const conflictingRule = existingRules.find((rule: any) =>
          String(rule['dst-port']) === String(publicPort) &&
          rule['to-addresses'] !== deviceLocalIp
        );

        if (conflictingRule) {
          this.logger.warn(`⚠️ [NAT CONFLICT] Puerto ${publicPort} ya está en uso por ${conflictingRule['to-addresses']}. Eliminando regla obsoleta vieja...`);
          try {
            const deleteUrl = `${url}/${conflictingRule['.id']}`;
            await axios.delete(deleteUrl, {
              auth: { username, password },
              httpsAgent,
              timeout: 5000,
              headers: {
                'User-Agent': 'curl/7.74.0',
                'Content-Type': 'application/json'
              }
            });
            this.logger.log(`✅ [NAT CONFLICT SOLVED] Regla conflictiva vieja eliminada exitosamente.`);
          } catch (delErr) {
            this.logger.error(`❌ [NAT DELETE ERROR] No se pudo eliminar la regla conflictiva: ${delErr.message}`);
          }
        }

        // 3. CREAR REGLA NUEVA SI NO EXISTE
        const payload = {
          chain: 'dstnat',
          action: 'dst-nat',
          protocol: protocolType,
          'dst-port': String(publicPort),
          'to-addresses': deviceLocalIp,
          'to-ports': targetLocalPort,
          comment: `Proliseg IoT NAT: ${deviceLocalIp}:${targetLocalPort}`
        };

        try {
          this.logger.log(`🔧 [NAT MAPPING] Enviando POST a MikroTik para crear regla NAT...`);
          await axios.post(url, payload, {
            auth: { username, password },
            httpsAgent,
            timeout: 10000,
            headers: {
              'User-Agent': 'curl/7.74.0',
              'Accept': '*/*',
              'Content-Type': 'application/json'
            }
          });
        } catch (postErr) {
          this.logger.warn(`⚠️ [NAT MAPPING] Falló POST a MikroTik (${postErr.message}). Reintentando con PUT (Requerido en RouterOS v7)...`);
          await axios.put(url, payload, {
            auth: { username, password },
            httpsAgent,
            timeout: 10000,
            headers: {
              'User-Agent': 'curl/7.74.0',
              'Accept': '*/*',
              'Content-Type': 'application/json'
            }
          });
        }

        this.logger.log(`✅ [NAT MAPPING] Regla NAT agregada con éxito para ${deviceLocalIp} -> puerto ${publicPort}`);
        return publicPort;

      } catch (err) {
        errorMsg = err.message;
        this.logger.error(`❌ [NAT MAPPING ERROR] (${protocol}): ${err.message}`);
      }
    }

    throw new Error(`No se pudo crear la regla NAT en el MikroTik: ${errorMsg}`);
  }

  private async ensureMasqueradeRule(
    url: string,
    deviceLocalIp: string,
    username: string,
    password: string,
    httpsAgent: any,
    existingRules: any[],
    targetLocalPort: string,
    protocolType: string = 'tcp'
  ): Promise<void> {
    const existingMasq = existingRules.find((rule: any) =>
      rule.chain === 'srcnat' &&
      rule.action === 'masquerade' &&
      rule.protocol === protocolType &&
      rule['dst-address'] === deviceLocalIp &&
      rule['dst-port'] === targetLocalPort
    );

    if (existingMasq) {
      this.logger.log(`ℹ️ [NAT MASQUERADE] Ya existe regla de retorno masquerade para ${deviceLocalIp}:${targetLocalPort} (${protocolType})`);
      return;
    }

    const payload = {
      chain: 'srcnat',
      action: 'masquerade',
      protocol: protocolType,
      'dst-address': deviceLocalIp,
      'dst-port': targetLocalPort,
      comment: `Masquerade retorno Proliseg: ${deviceLocalIp}:${targetLocalPort}`
    };

    try {
      this.logger.log(`🔧 [NAT MASQUERADE] Creando regla de retorno (masquerade) para ${deviceLocalIp}...`);
      await axios.post(url, payload, {
        auth: { username, password },
        httpsAgent,
        timeout: 8000,
        headers: {
          'User-Agent': 'curl/7.74.0',
          'Accept': '*/*',
          'Content-Type': 'application/json'
        }
      });
    } catch (err) {
      try {
        this.logger.warn(`⚠️ [NAT MASQUERADE] Falló POST para masquerade, reintentando con PUT...`);
        await axios.put(url, payload, {
          auth: { username, password },
          httpsAgent,
          timeout: 8000,
          headers: {
            'User-Agent': 'curl/7.74.0',
            'Accept': '*/*',
            'Content-Type': 'application/json'
          }
        });
      } catch (putErr) {
        this.logger.error(`❌ [NAT MASQUERADE ERROR] No se pudo crear la regla de retorno masquerade: ${putErr.message}`);
      }
    }
  }

  async validateCredentials(ip: string, user: string, pass: string): Promise<any> {
    let targetIp = ip;
    let targetPort = 80;

    // Auto-resolución de IPs privadas vía MikroTik
    const isPrivate = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(ip);
    if (isPrivate) {
      try {
        const { data: servers } = await this.supabase
          .getClient()
          .from('control_acceso_servidores_mikrotik')
          .select('*')
          .limit(1);

        if (servers && servers.length > 0) {
          const srv = servers[0];
          const lastOctet = ip.split('.').pop();
          const mappedPort = 10000 + Number(lastOctet || '80');

          this.logger.log(`🔧 [AUTO-NAT] Creando/Verificando regla NAT en MikroTik ${srv.ip_publica} para validación de ${ip} al puerto ${mappedPort}...`);

          await this.addMikrotikNatRule(
            srv.ip_publica,
            ip,
            mappedPort,
            srv.usuario,
            srv.password,
            String(srv.puerto_rest || 4433)
          );

          targetIp = srv.ip_publica;
          targetPort = mappedPort;
        }
      } catch (err) {
        this.logger.error(`❌ [AUTO-NAT ERROR] No se pudo auto-mapear NAT para validación: ${err.message}`);
      }
    }

    const url = `${this.proxyUrl}/validate`;
    try {
      const response = await axios.post(url, {}, {
        headers: {
          'X-API-Key': this.apiKey,
          'X-Target-IP': targetIp,
          'X-Target-Port': String(targetPort),
          'X-Target-User': user,
          'X-Target-Pass': pass
        },
        timeout: 15000
      });
      return response.data;
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  async uploadRostro(ip: string, userId: string, faceData: string): Promise<any> {
    const isapiPath = `/ISAPI/Intelligent/FDLib/FaceDataRecord?format=json`;
    const body = {
      faceLibType: 'blackList',
      FDLibID: '1',
      FPID: userId,
      faceData: faceData
    };
    return this.proxyRequestDynamic(ip, 'post', isapiPath, body);
  }

  async crearUsuarioEnHardware(ip: string, userId: string, nombre: string): Promise<any> {
    const isapiPath = `/ISAPI/AccessControl/UserInfo/Record?format=json`;
    const body = {
      UserInfo: {
        employeeNo: userId,
        name: nombre.slice(0, 32),
        userType: 'normal',
        Valid: {
          enable: true,
          beginTime: '2026-01-01T00:00:00',
          endTime: '2036-12-31T23:59:59',
          timeType: 'local',
        },
        doorRight: '1',
        RightPlan: [
          {
            doorNo: 1,
            planTemplateNo: '1',
          },
        ],
      },
    };
    try {
      return await this.proxyRequestDynamic(ip, 'post', isapiPath, body);
    } catch (error) {
      this.logger.warn(`⚠️ [HARDWARE] POST UserInfo/Record falló, probando PUT: ${error.message}`);
      return this.proxyRequestDynamic(ip, 'put', isapiPath, body);
    }
  }

  async registrarTarjetaEnHardware(ip: string, userId: string, cardNo: string): Promise<any> {
    if (!cardNo) return { ok: true, message: 'No card provided' };
    const isapiPath = `/ISAPI/AccessControl/CardInfo/Record?format=json`;
    const body = {
      CardInfo: {
        employeeNo: userId,
        cardNo: cardNo,
        cardType: 'normal',
        leaderCard: false,
      },
    };
    try {
      return await this.proxyRequestDynamic(ip, 'post', isapiPath, body);
    } catch (error) {
      this.logger.warn(`⚠️ [HARDWARE] POST CardInfo/Record falló, probando PUT: ${error.message}`);
      return this.proxyRequestDynamic(ip, 'put', isapiPath, body);
    }
  }

  async eliminarUsuarioDeHardware(ip: string, userId: string): Promise<any> {
    const isapiPath = `/ISAPI/AccessControl/UserInfo/Delete?format=json`;
    const body = {
      UserInfoDetail: {
        mode: 'byEmployeeNo',
        EmployeeNoList: [
          {
            employeeNo: userId,
          },
        ],
      },
    };
    return this.proxyRequestDynamic(ip, 'put', isapiPath, body);
  }

  async pushPersonaToDevice(personaId: string, dispositivoId: string): Promise<any> {
    const admin = this.supabase.getSupabaseAdminClient();

    const { data: persona, error: pErr } = await admin
      .from('personas_gestion_acceso')
      .select('*')
      .eq('id', personaId)
      .single();

    if (pErr || !persona) {
      throw new Error(`Persona ${personaId} no encontrada: ${pErr?.message}`);
    }

    const { data: device, error: dErr } = await admin
      .from('dispositivos_iot')
      .select('*')
      .eq('id', dispositivoId)
      .single();

    if (dErr || !device) {
      throw new Error(`Dispositivo ${dispositivoId} no encontrado: ${dErr?.message}`);
    }

    const ip = device.ip_direccion;
    if (!ip) {
      throw new Error(`Dispositivo ${dispositivoId} no tiene IP asignada`);
    }

    await this.crearUsuarioEnHardware(ip, persona.documento_identidad, persona.nombre_completo);

    if (persona.codigo_tarjeta) {
      await this.registrarTarjetaEnHardware(ip, persona.documento_identidad, persona.codigo_tarjeta);
    }

    const { data: facial } = await admin
      .from('biometria_facial')
      .select('foto_url_storage')
      .eq('persona_id', personaId)
      .order('fecha_captura', { ascending: false })
      .limit(1)
      .maybeSingle();

    const fotoUrl = facial?.foto_url_storage || persona.foto_rostro_url;
    if (fotoUrl) {
      try {
        let base64Photo = '';
        if (fotoUrl.startsWith('data:image/')) {
          base64Photo = fotoUrl.split(',')[1] || '';
        } else {
          const response = await axios.get(fotoUrl, { responseType: 'arraybuffer', timeout: 15000 });
          base64Photo = Buffer.from(response.data).toString('base64');
        }

        if (base64Photo) {
          await this.uploadRostro(ip, persona.documento_identidad, base64Photo);
        }
      } catch (err) {
        this.logger.warn(`⚠️ [HARDWARE SYNC] No se pudo subir foto de rostro a ${ip}: ${err.message}`);
      }
    }

    return { ok: true };
  }

  async syncRecopilacionRegistro(registroId: number, dispositivoIds: string[]): Promise<any> {
    const admin = this.supabase.getSupabaseAdminClient();

    const { data: rec, error: recErr } = await admin
      .from('control_acceso_recoleccion_registros')
      .select('*, lugar:control_acceso_recoleccion_lugares(*)')
      .eq('id', registroId)
      .single();

    if (recErr || !rec) {
      throw new Error(`Registro de recopilación ${registroId} no encontrado: ${recErr?.message}`);
    }

    const personaInput = {
      nombre_completo: rec.nombre_completo,
      documento_identidad: rec.cedula,
      lista_estado: 'blanca',
      entidad_tipo: 'residente',
      activo: true,
      foto_rostro_url: rec.foto_rostro_url,
    };

    const { data: persona, error: pErr } = await admin
      .from('personas_gestion_acceso')
      .upsert([personaInput], { onConflict: 'documento_identidad' })
      .select()
      .single();

    if (pErr || !persona) {
      throw new Error(`Error al upsertar persona: ${pErr?.message}`);
    }

    if (dispositivoIds && dispositivoIds.length > 0) {
      await this.vincularPersonaDispositivos(persona.id, dispositivoIds);
    }

    if (rec.foto_rostro_url) {
      const { data: existingFacial } = await admin
        .from('biometria_facial')
        .select('id')
        .eq('persona_id', persona.id)
        .eq('foto_url_storage', rec.foto_rostro_url)
        .maybeSingle();

      if (!existingFacial) {
        await admin
          .from('biometria_facial')
          .insert({
            persona_id: persona.id,
            foto_url_storage: rec.foto_rostro_url,
            sincronizado_en_biometrico: true,
          });
      }
    }

    let residentResult: any = null;
    if (rec.correo_electronico && rec.cedula) {
      try {
        residentResult = await this.asegurarCuentaResidente({
          cedula: rec.cedula,
          nombre_completo: rec.nombre_completo,
          correo: rec.correo_electronico,
          telefono: rec.telefono,
          torre: rec.torre,
          apartamento: rec.apartamento,
          puesto_id: rec.lugar?.creado_por || null,
        });

        if (residentResult?.residente?.id) {
          await admin
            .from('personas_gestion_acceso')
            .update({ entidad_tipo: 'residente', entidad_id: residentResult.residente.id })
            .eq('id', persona.id);
        }
      } catch (authErr) {
        this.logger.warn(`⚠️ [RESIDENT AUTO-PROVISION] FAILED for ${rec.cedula}: ${authErr.message}`);
      }
    }

    if (dispositivoIds && dispositivoIds.length > 0) {
      for (const devId of dispositivoIds) {
        try {
          await this.pushPersonaToDevice(persona.id, devId);
        } catch (syncErr) {
          this.logger.error(`❌ [HARDWARE SYNC ERROR] No se pudo empujar persona ${persona.id} al dispositivo ${devId}: ${syncErr.message}`);
        }
      }
    }

    return {
      ok: true,
      persona_id: persona.id,
      residente: residentResult,
    };
  }

  async asegurarCuentaResidente(input: {
    cedula: string;
    nombre_completo: string;
    correo: string;
    telefono?: string;
    torre?: string;
    apartamento?: string;
    cliente_id?: number;
    puesto_id?: number;
  }): Promise<any> {
    const admin = this.supabase.getSupabaseAdminClient();

    let { data: usuarioExt, error: uError } = await admin
      .from('usuarios_externos')
      .select('*')
      .eq('cedula', input.cedula)
      .maybeSingle();

    if (uError) {
      throw new Error(`Error al buscar usuario externo: ${uError.message}`);
    }

    if (!usuarioExt) {
      const authResponse = await admin.auth.admin.createUser({
        email: input.correo,
        password: input.cedula,
        email_confirm: true,
        user_metadata: { nombre_completo: input.nombre_completo },
      });

      if (authResponse.error) {
        throw new Error(`Error al crear usuario en Supabase Auth: ${authResponse.error.message}`);
      }

      const authUser = authResponse.data.user;

      const { data: newUsuarioExt, error: insErr } = await admin
        .from('usuarios_externos')
        .insert({
          user_id: authUser.id,
          nombre_completo: input.nombre_completo,
          cedula: input.cedula,
          correo: input.correo,
          telefono: input.telefono || null,
          rol: 'residente',
          estado: true,
        })
        .select()
        .single();

      if (insErr) {
        throw new Error(`Error al crear usuarios_externos: ${insErr.message}`);
      }

      usuarioExt = newUsuarioExt;
    }

    let clienteId = input.cliente_id;
    let puestoId = input.puesto_id;

    if (!clienteId) {
      const { data: firstClient } = await admin.from('clientes').select('id').limit(1).maybeSingle();
      clienteId = firstClient?.id || 1;
    }

    if (!puestoId) {
      const { data: firstPuesto } = await admin.from('puestos_trabajo').select('id').limit(1).maybeSingle();
      puestoId = firstPuesto?.id || 1;
    }

    let { data: residente, error: rError } = await admin
      .from('residentes')
      .select('*')
      .eq('documento', input.cedula)
      .maybeSingle();

    const residenteData = {
      cliente_id: clienteId,
      puesto_id: puestoId,
      usuario_id: usuarioExt.id,
      nombre_completo: input.nombre_completo,
      documento: input.cedula,
      torre_bloque: input.torre || null,
      apto_casa: input.apartamento || null,
      telefono: input.telefono || null,
      correo: input.correo || null,
      tipo_habitante: 'propietario',
      activo: true,
    };

    if (!residente) {
      const { data: newResidente, error: insResErr } = await admin
        .from('residentes')
        .insert(residenteData)
        .select()
        .single();

      if (insResErr) {
        throw new Error(`Error al crear residente: ${insResErr.message}`);
      }
      residente = newResidente;
    } else {
      const { data: updatedResidente, error: updResErr } = await admin
        .from('residentes')
        .update({
          usuario_id: usuarioExt.id,
          correo: input.correo,
          telefono: input.telefono || residente.telefono,
          torre_bloque: input.torre || residente.torre_bloque,
          apto_casa: input.apartamento || residente.apto_casa,
        })
        .eq('id', residente.id)
        .select()
        .single();

      if (updResErr) {
        throw new Error(`Error al actualizar residente: ${updResErr.message}`);
      }
      residente = updatedResidente;
    }

    return {
      usuario: usuarioExt,
      residente: residente,
    };
  }

  async deletePersona(personaId: string): Promise<any> {
    const admin = this.supabase.getSupabaseAdminClient();

    const { data: persona, error: pErr } = await admin
      .from('personas_gestion_acceso')
      .select('*')
      .eq('id', personaId)
      .single();

    if (pErr || !persona) {
      throw new Error(`Persona no encontrada: ${pErr?.message}`);
    }

    const { data: permisos } = await admin
      .from('acceso_permisos_dispositivos')
      .select('*, dispositivo:dispositivos_iot(*)')
      .eq('persona_id', personaId);

    for (const p of permisos || []) {
      const ip = p.dispositivo?.ip_direccion;
      if (ip) {
        try {
          await this.eliminarUsuarioDeHardware(ip, persona.documento_identidad);
        } catch (err) {
          this.logger.warn(`⚠️ [HARDWARE SYNC] No se pudo eliminar usuario ${persona.documento_identidad} de ${ip}: ${err.message}`);
        }
      }
    }

    await admin.from('biometria_facial').delete().eq('persona_id', personaId);
    await admin.from('acceso_permisos_dispositivos').delete().eq('persona_id', personaId);

    const { error: delErr } = await admin
      .from('personas_gestion_acceso')
      .delete()
      .eq('id', personaId);

    if (delErr) {
      throw delErr;
    }

    return { ok: true };
  }

  private async proxyRequestDynamic(
    targetIp: string,
    method: string,
    path: string,
    data: any = null,
    params: any = {}
  ): Promise<any> {
    const { customTimeout, responseType, ...queryParams } = params || {};
    const query = new URLSearchParams(queryParams).toString();
    const finalPath = `${path}${query ? (path.includes('?') ? '&' : '?') + query : ''}`;

    let resolvedIp = targetIp;
    let targetPort = 80;
    let user = 'admin';
    let pass = 'proliseg#123';

    try {
      // 1. Consultar base de datos para recuperar credenciales y puerto
      let dbQuery = this.supabase.getClient().from('dispositivos_iot').select('*');
      if (params.deviceId) {
        dbQuery = dbQuery.eq('id', params.deviceId);
      } else {
        dbQuery = dbQuery.eq('ip_direccion', targetIp);
      }

      const { data: devices } = await dbQuery;
      if (devices && devices.length > 0) {
        const dev = devices[0];
        user = dev.credencial_usuario || 'admin';
        pass = dev.credencial_password || '';
        // Si el dispositivo tiene puertos mapeados por VPN, usamos el mapeado
        const mappedHttp = dev.configuracion_tecnica?.puertos_mapeados?.mapped_http;
        if (mappedHttp) {
          targetPort = mappedHttp;
        } else {
          targetPort = dev.configuracion_tecnica?.puerto || dev.puerto_servicio || 80;
        }
      }
    } catch (dbErr) { }

    // Auto-resolución de IPs privadas
    const isPrivate = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(targetIp);
    if (isPrivate && !targetIp.startsWith('10.8.')) {
      try {
        const { data: servers } = await this.supabase
          .getClient()
          .from('control_acceso_servidores_mikrotik')
          .select('*')
          .limit(1);

        if (servers && servers.length > 0) {
          const srv = servers[0];
          const lastOctet = targetIp.split('.').pop();
          const mappedPort = 10000 + Number(lastOctet || '80');
          resolvedIp = srv.ip_publica;
          targetPort = mappedPort;
        }
      } catch (err) { }
    }

    try {
      const url = `http://${resolvedIp}:${targetPort}${finalPath}`;
      const timeout = customTimeout || 15000;
      return await this.executeDigestAuth(method.toUpperCase(), url, user, pass, data, responseType || 'json', timeout);
    } catch (error) {
      this.logger.error(`❌ [DIRECT ISAPI ERROR] ${resolvedIp}:${targetPort}${path}: ${error.message}`);
      throw error;
    }
  }

  private async executeDigestAuth(
    method: string,
    url: string,
    user: string,
    pass: string,
    data?: any,
    responseType: string = 'json',
    timeout: number = 15000,
    headers: Record<string, string> = {},
  ): Promise<any> {
    const response = await this.executeDigestAuthRequest(method, url, user, pass, data, responseType, timeout, headers);
    return response.data;
  }

  private async executeDigestAuthRequest(
    method: string,
    url: string,
    user: string,
    pass: string,
    data?: any,
    responseType: string = 'json',
    timeout: number = 15000,
    headers: Record<string, string> = {},
  ): Promise<any> {
    const host = new URL(url).host;
    const cached = this.digestChallengeCache.get(host);

    if (cached) {
      const { realm, nonce, qop } = cached;
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

      const config: any = {
        method,
        url,
        headers: { ...headers, 'Authorization': authStr },
        timeout,
        responseType
      };
      if (data !== undefined && data !== null) config.data = data;

      try {
        this.logger.debug(`⚡ [DIGEST CACHE HIT] Sending pre-authenticated request to ${host}`);
        return await axios(config);
      } catch (error) {
        if (error.response && error.response.status === 401) {
          this.logger.debug(`⚠️ [DIGEST CACHE EXPIRED] Pre-authenticated request failed with 401. Clearing cache for ${host}`);
          this.digestChallengeCache.delete(host);
        } else {
          throw error;
        }
      }
    }

    try {
      const config: any = { method, url, timeout, responseType, headers };
      if (data !== undefined && data !== null) config.data = data;
      return await axios(config);
    } catch (error) {
      if (error.response && error.response.status === 401 && error.response.headers['www-authenticate']) {
        const authHeader = error.response.headers['www-authenticate'];
        if (authHeader.includes('Digest')) {
          const matchRealm = authHeader.match(/realm="([^"]+)"/);
          const matchNonce = authHeader.match(/nonce="([^"]+)"/);
          const matchQop = authHeader.match(/qop="([^"]+)"/);

          if (matchRealm && matchNonce) {
            const realm = matchRealm[1];
            const nonce = matchNonce[1];
            const qopRaw = matchQop ? matchQop[1] : '';
            const qopOptions = qopRaw.split(',').map((item: string) => item.trim()).filter(Boolean);
            const qop = qopOptions.includes('auth') ? 'auth' : (qopOptions[0] || '');

            // Guardar en la caché para evitar la doble petición en el siguiente comando
            this.digestChallengeCache.set(host, { realm, nonce, qop });
            this.logger.debug(`💾 [DIGEST CACHE SAVE] Cached challenge for ${host}`);

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

            const config2: any = {
              method,
              url,
              headers: { ...headers, 'Authorization': authStr },
              timeout,
              responseType
            };
            if (data !== undefined && data !== null) config2.data = data;

            return await axios(config2);
          }
        }
      }
      throw error;
    }
  }

  async getLugaresRecopilacion() {
    const { data, error } = await this.supabase
      .getClient()
      .from('control_acceso_recoleccion_lugares')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async createLugarRecopilacion(input: {
    nombre_lugar: string;
    descripcion?: string;
    requiere_torre?: boolean;
    codigo_seguridad?: string;
    creado_por?: number;
  }) {
    const token = randomBytes(16).toString('hex');
    const payload = {
      nombre_lugar: input.nombre_lugar,
      descripcion: input.descripcion || null,
      requiere_torre: input.requiere_torre ?? false,
      token_publico: token,
      codigo_seguridad: input.codigo_seguridad || null,
      activo: true,
      creado_por: input.creado_por || null,
    };
    const { data, error } = await this.supabase
      .getClient()
      .from('control_acceso_recoleccion_lugares')
      .insert(payload)
      .select('*')
      .single();
    if (error) throw error;
    return {
      ...data,
      link_publico: `/public/control-acceso/recopilacion/${token}`,
    };
  }

  async getRegistrosRecopilacion(lugarId: number) {
    const { data, error } = await this.supabase
      .getClient()
      .from('control_acceso_recoleccion_registros')
      .select('*')
      .eq('lugar_id', lugarId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async getPublicForm(token: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('control_acceso_recoleccion_lugares')
      .select('id,nombre_lugar,descripcion,requiere_torre,activo')
      .eq('token_publico', token)
      .maybeSingle();
    if (error) throw error;
    if (!data || !data.activo) return null;
    return data;
  }

  async validarCodigo(token: string, codigo: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('control_acceso_recoleccion_lugares')
      .select('id,codigo_seguridad,activo')
      .eq('token_publico', token)
      .maybeSingle();
    if (error) throw error;
    if (!data || !data.activo) return { ok: false };
    const requiredCode = String((data as any).codigo_seguridad || '').trim();
    if (!requiredCode) return { ok: true };
    return { ok: requiredCode === String(codigo || '').trim() };
  }

  async registrarPublico(token: string, body: any, req: any) {
    const form = await this.getPublicForm(token);
    if (!form) throw new Error('Formulario no disponible');
    const checkCode = await this.validarCodigo(token, body?.codigo_seguridad || '');
    if (!checkCode.ok) throw new Error('Código de seguridad inválido');
    if (!body?.acepta_tratamiento_datos) throw new Error('Debe aceptar tratamiento de datos');
    if (!body?.foto_base64) throw new Error('Debe adjuntar una foto de rostro');

    let fotoUrl: string | null = null;
    if (body.foto_base64 && String(body.foto_base64).startsWith('data:image/')) {
      const match = String(body.foto_base64).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (match) {
        const contentType = match[1] === 'image/png' ? 'image/png' : 'image/jpeg';
        const ext = contentType === 'image/png' ? 'png' : 'jpg';
        const fileName = `control-acceso-${form.id}-${Date.now()}.${ext}`;
        const filePath = `${form.id}/${fileName}`;
        const fileBuffer = Buffer.from(match[2], 'base64');
        const { error: uploadError } = await this.supabase
          .getSupabaseAdminClient()
          .storage
          .from('control-acceso-faces')
          .upload(filePath, fileBuffer, { upsert: true, contentType });
        if (uploadError) {
          this.logger.error(`Error subiendo rostro de recopilacion: ${uploadError.message}`);
          throw uploadError;
        }
        const { data: pub } = this.supabase.getSupabaseAdminClient().storage.from('control-acceso-faces').getPublicUrl(filePath);
        fotoUrl = pub?.publicUrl || null;
      }
    }
    if (!fotoUrl) throw new Error('No se pudo guardar la foto de rostro');

    const payload = {
      lugar_id: form.id,
      nombre_completo: body.nombre_completo,
      cedula: body.cedula,
      telefono: body.telefono,
      telefono2: body.telefono2 || null,
      correo_electronico: body.correo_electronico || null,
      apartamento: body.apartamento || null,
      torre: body.torre || null,
      placa_vehiculo: body.placa_vehiculo || null,
      color_vehiculo: body.color_vehiculo || null,
      foto_rostro_url: fotoUrl,
      acepta_tratamiento_datos: true,
      acepta_ingreso_prolicontrol: !!body.acepta_ingreso_prolicontrol,
      consentimiento_aceptado_at: body.consentimiento_aceptado_at || new Date().toISOString(),
      geolocation_lat: body.geolocation_lat || null,
      geolocation_lng: body.geolocation_lng || null,
      geolocation_accuracy: body.geolocation_accuracy || null,
      user_agent: req?.headers?.['user-agent'] || null,
      ip_origen: req?.ip || null,
    };
    const { data, error } = await this.supabase
      .getSupabaseAdminClient()
      .from('control_acceso_recoleccion_registros')
      .insert(payload)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  // --- MÉTODOS DE CONFIGURACIÓN (MIKROTIK & MODELOS) ---

  async findServidoresMikrotik() {
    const { data, error } = await this.supabase
      .getClient()
      .from('control_acceso_servidores_mikrotik')
      .select('*')
      .order('nombre', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async createServidorMikrotik(payload: any) {
    const { data, error } = await this.supabase
      .getClient()
      .from('control_acceso_servidores_mikrotik')
      .insert([payload])
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async deleteServidorMikrotik(id: number) {
    const { data, error } = await this.supabase
      .getClient()
      .from('control_acceso_servidores_mikrotik')
      .delete()
      .eq('id', id)
      .select();
    if (error) throw error;
    return data[0];
  }

  async findModelosDispositivos() {
    const { data, error } = await this.supabase
      .getClient()
      .from('control_acceso_modelos_dispositivos')
      .select('*')
      .order('nombre', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async createModeloDispositivo(payload: any) {
    const { data, error } = await this.supabase
      .getClient()
      .from('control_acceso_modelos_dispositivos')
      .insert([payload])
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async deleteModeloDispositivo(id: number) {
    const { data, error } = await this.supabase
      .getClient()
      .from('control_acceso_modelos_dispositivos')
      .delete()
      .eq('id', id)
      .select();
    if (error) throw error;
    return data[0];
  }
}
