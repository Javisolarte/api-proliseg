import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateDispositivoDto, CreatePersonaAccesoDto } from './dto/control-acceso.dto';
import { randomBytes, createHash } from 'crypto';

@Injectable()
export class ControlAccesoService {
  private readonly logger = new Logger(ControlAccesoService.name);


  private readonly proxyUrl = 'https://servidor.proliseg.com/dispositivos';
  private readonly apiKey = 'proliseg-acceso-2026';

  constructor(private readonly supabase: SupabaseService) { }

  /**
   * DATABASE METHODS (SUPABASE)
   */

  async findAllDispositivos() {
    const { data, error } = await this.supabase
      .getClient()
      .from('dispositivos_iot')
      .select('*, puesto:puestos_trabajo(nombre)');
    if (error) throw error;
    return data;
  }

  async createDispositivo(dto: any) {
    const { mikrotik_ip, mikrotik_usuario, mikrotik_password, mikrotik_puerto, ...insertData } = dto;

    let finalIp = insertData.ip_direccion;
    let finalPort = insertData.puerto_servicio || 80;

    // Almacenamos mapeos adicionales para usarlos después
    let mappedPortsInfo = {};

    if (mikrotik_ip && insertData.ip_direccion) {
      // Se escaneó vía MikroTik, mapear el reenvío de puertos NAT
      try {
        const lastOctet = insertData.ip_direccion.split('.').pop();
        const baseOffset = Number(lastOctet || '80');

        const mappedHttpPort = 10000 + baseOffset;
        const mappedSdkPort = 20000 + baseOffset;
        const mappedRtspPort = 30000 + baseOffset;

        this.logger.log(`🔧 [NAT MAPPING] Creando reglas NAT en MikroTik ${mikrotik_ip} para ${insertData.ip_direccion}...`);

        // Mapear HTTP (80)
        const finalActivePort = await this.addMikrotikNatRule(
          mikrotik_ip, insertData.ip_direccion, mappedHttpPort, mikrotik_usuario, mikrotik_password, mikrotik_puerto, '80'
        );

        // Mapear SDK (8000)
        await this.addMikrotikNatRule(
          mikrotik_ip, insertData.ip_direccion, mappedSdkPort, mikrotik_usuario, mikrotik_password, mikrotik_puerto, '8000'
        );

        // Mapear RTSP (554)
        await this.addMikrotikNatRule(
          mikrotik_ip, insertData.ip_direccion, mappedRtspPort, mikrotik_usuario, mikrotik_password, mikrotik_puerto, '554'
        );

        // Actualizar detalles del dispositivo con la IP de la VPN del MikroTik y puerto mapeado HTTP principal
        finalIp = mikrotik_ip;
        finalPort = finalActivePort;

        mappedPortsInfo = {
          mapped_http: mappedHttpPort,
          mapped_sdk: mappedSdkPort,
          mapped_rtsp: mappedRtspPort,
          original_ip: insertData.ip_direccion
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
        tipo: insertData.tipo || 'control_acceso',
        esta_online: true,
        puertos_mapeados: mappedPortsInfo
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
    return data[0];
  }

  async updateDispositivo(id: string, dto: any) {
    const payload = {
      nombre_identificador: dto.nombre_identificador || dto.nombre,
      puesto_id: dto.puesto_id || null,
      ip_direccion: dto.ip_direccion || dto.ip,
      sn_serie: dto.sn_serie || dto.sn_serial,
      credencial_usuario: dto.dispositivo_usuario || dto.credencial_usuario || 'admin',
      credencial_password: dto.dispositivo_password || dto.credencial_password || '',
      estado: dto.estado || 'operativo',
      configuracion_tecnica: {
        marca: dto.configuracion_tecnica?.marca || dto.marca || 'Hikvision',
        modelo: dto.configuracion_tecnica?.modelo || dto.modelo || '',
        puerto: dto.configuracion_tecnica?.puerto || dto.puerto_servicio || dto.puerto || 80,
        tipo: dto.tipo || dto.configuracion_tecnica?.tipo || 'control_acceso',
        esta_online: dto.esta_online ?? true
      }
    };

    const { data, error } = await this.supabase
      .getClient()
      .from('dispositivos_iot')
      .update(payload)
      .eq('id', id)
      .select();
    if (error) throw error;
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
    return data[0];
  }

  async findAllPersonas() {
    const { data, error } = await this.supabase
      .getClient()
      .from('personas_gestion_acceso')
      .select('*');
    if (error) throw error;
    return data;
  }

  async createPersona(dto: CreatePersonaAccesoDto) {
    const { dispositivos_ids, ...personaData } = dto;

    // 1. Crear persona
    const { data: persona, error: pError } = await this.supabase
      .getClient()
      .from('personas_gestion_acceso')
      .insert([personaData])
      .select();

    if (pError) throw pError;

    // 2. Vincular con dispositivos si existen
    if (dispositivos_ids && dispositivos_ids.length > 0) {
      const permisos = dispositivos_ids.map(dId => ({
        persona_id: persona[0].id,
        dispositivo_id: dId
      }));
      await this.supabase.getClient().from('acceso_permisos_dispositivos').insert(permisos);
    }

    return persona[0];
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

  async controlPuerta(ip: string, doorId: number = 1, command: 'abrir' | 'cerrar' | 'siempre-abierta' | 'siempre-cerrada'): Promise<any> {
    let xmlCommand = 'open';
    if (command === 'cerrar') xmlCommand = 'close';
    if (command === 'siempre-abierta') xmlCommand = 'alwaysOpen';
    if (command === 'siempre-cerrada') xmlCommand = 'alwaysClose';

    const body = `<RemoteControlDoor><cmd>${xmlCommand}</cmd></RemoteControlDoor>`;
    return this.proxyRequestDynamic(ip, 'put', `/ISAPI/AccessControl/RemoteControl/door/${doorId}`, body);
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
      const user = dev.credencial_usuario || 'admin';
      const pass = dev.credencial_password || 'proliseg#123';
      const targetIp = dev.ip_direccion; // Debe ser la IP VPN, ej. 10.8.0.2

      let rtspPort = 554;
      if (dev.puertos_mapeados && dev.puertos_mapeados.mapped_rtsp) {
        rtspPort = dev.puertos_mapeados.mapped_rtsp;
      }

      // Armar la URL de la fuente RTSP (Volvemos al 101, los biométricos de acceso a veces no tienen 102)
      const sourceUrl = `rtsp://${user}:${pass}@${targetIp}:${rtspPort}/Streaming/Channels/101`;
      // Nombre simple de la cámara sin slashes para evitar errores 404 en la API
      const streamName = `cam_${deviceId.substring(0, 8)}`;

      // 2. Registrar la ruta en la API de MediaMTX DIRECTO a la IP interna del servidor
      const vpsIp = '10.0.1.1';
      try {
        await axios.post(`http://${vpsIp}:9997/v3/config/paths/add/${streamName}`, {
          source: sourceUrl,
          sourceOnDemand: false, // APAGADO: Mantiene el video fluyendo 24/7 para que cargue instantáneamente
          rtspTransport: 'tcp'  // Forzar TCP para evitar bloqueos del MikroTik en UDP
        });
      } catch (err) {
        // Si la ruta ya existe (error 400), la eliminamos y la volvemos a crear para forzar la actualización
        if (err.response?.status === 400) {
          try {
            await axios.delete(`http://${vpsIp}:9997/v3/config/paths/delete/${streamName}`);
            await axios.post(`http://${vpsIp}:9997/v3/config/paths/add/${streamName}`, {
              source: sourceUrl,
              sourceOnDemand: false, // 24/7 para velocidad extrema
              rtspTransport: 'tcp'
            });
            this.logger.log(`🔄 [WEBRTC] Ruta ${streamName} actualizada automáticamente.`);
          } catch (updateErr) {
            this.logger.warn(`⚠️ [WEBRTC] Error actualizando ruta en MediaMTX: ${updateErr.message}`);
          }
        } else {
          this.logger.warn(`⚠️ [WEBRTC] Error registrando ruta en MediaMTX: ${err.message}`);
        }
      }

      // Retornar las rutas con el prefijo /webrtc/ que maneja el frontend y el iframe
      const domain = 'servidor.proliseg.com';
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

  async syncUsuariosHardware(ip: string): Promise<any> {
    // Para simplificar, obtenemos los datos por ISAPI básico
    return this.proxyRequestDynamic(ip, 'get', '/ISAPI/AccessControl/UserInfo/Search?format=json');
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
    targetLocalPort: string = '80'
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
        await this.ensureMasqueradeRule(url, deviceLocalIp, username, password, httpsAgent, existingRules);

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
          protocol: 'tcp',
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
    existingRules: any[]
  ): Promise<void> {
    const existingMasq = existingRules.find((rule: any) =>
      rule.chain === 'srcnat' &&
      rule.action === 'masquerade' &&
      rule['dst-address'] === deviceLocalIp
    );

    if (existingMasq) {
      this.logger.log(`ℹ️ [NAT MASQUERADE] Ya existe regla de retorno masquerade para ${deviceLocalIp}`);
      return;
    }

    const payload = {
      chain: 'srcnat',
      action: 'masquerade',
      protocol: 'tcp',
      'dst-address': deviceLocalIp,
      'dst-port': '80',
      comment: `Masquerade retorno Proliseg: ${deviceLocalIp}`
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

  private async proxyRequestDynamic(
    targetIp: string,
    method: string,
    path: string,
    data: any = null,
    params: any = {}
  ): Promise<any> {
    const query = new URLSearchParams(params).toString();
    const finalPath = `${path}${query ? '?' + query : ''}`;

    let resolvedIp = targetIp;
    let targetPort = 80;
    let user = 'admin';
    let pass = 'proliseg#123';

    try {
      // 1. Consultar base de datos para recuperar credenciales y puerto
      let dbQuery = this.supabase.getClient().from('dispositivos_iot').select('*');
      dbQuery = dbQuery.eq('ip_direccion', targetIp);

      const { data: devices } = await dbQuery;
      if (devices && devices.length > 0) {
        const dev = devices[0];
        user = dev.credencial_usuario || 'admin';
        pass = dev.credencial_password || '';
        // Si el dispositivo tiene puertos mapeados por VPN, usamos el mapeado
        if (dev.puertos_mapeados && dev.puertos_mapeados.mapped_http) {
          targetPort = dev.puertos_mapeados.mapped_http;
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
      const timeout = params.customTimeout || 15000;
      return await this.executeDigestAuth(method.toUpperCase(), url, user, pass, data, 'json', timeout);
    } catch (error) {
      this.logger.error(`❌ [DIRECT ISAPI ERROR] ${resolvedIp}:${targetPort}${path}: ${error.message}`);
      throw error;
    }
  }

  private async executeDigestAuth(method: string, url: string, user: string, pass: string, data?: any, responseType: string = 'json', timeout: number = 15000): Promise<any> {
    try {
      const config: any = { method, url, timeout, responseType };
      if (data) config.data = data;
      const response = await axios(config);
      return response.data;
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
            const qop = matchQop ? matchQop[1] : '';
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
              headers: { 'Authorization': authStr },
              timeout,
              responseType
            };
            if (data) config2.data = data;

            const secondResponse = await axios(config2);
            return secondResponse.data;
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
