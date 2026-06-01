import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateDispositivoDto, CreatePersonaAccesoDto } from './dto/control-acceso.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class ControlAccesoService {
  private readonly logger = new Logger(ControlAccesoService.name);

  // Proxy de Hikvision corriendo en el PowerEdge bajo servidor.proliseg.com
  private readonly proxyUrl = 'https://servidor.proliseg.com/dispositivos';
  private readonly apiKey = 'proliseg-acceso-2026';

  constructor(private readonly supabase: SupabaseService) {}

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
    
    if (mikrotik_ip && insertData.ip_direccion) {
      // Se escaneó vía MikroTik, mapear el reenvío de puertos NAT
      try {
        const lastOctet = insertData.ip_direccion.split('.').pop();
        const mappedPort = 10000 + Number(lastOctet || '80');
        
        this.logger.log(`🔧 [NAT MAPPING] Creando regla NAT en MikroTik ${mikrotik_ip} para ${insertData.ip_direccion} al puerto público ${mappedPort}...`);
        
        await this.addMikrotikNatRule(
          mikrotik_ip,
          insertData.ip_direccion,
          mappedPort,
          mikrotik_usuario,
          mikrotik_password,
          mikrotik_puerto
        );
        
        // Actualizar detalles del dispositivo con la IP pública del MikroTik y puerto mapeado
        finalIp = mikrotik_ip;
        finalPort = mappedPort;
      } catch (err) {
        this.logger.error(`❌ [NAT MAPPING ERROR] Falló la creación de regla NAT: ${err.message}`);
      }
    }
    
    const payload = {
      nombre_identificador: insertData.nombre_identificador || insertData.nombre || 'Nuevo Dispositivo',
      puesto_id: insertData.puesto_id || null,
      ip_direccion: finalIp,
      puerto_servicio: finalPort,
      dispositivo_usuario: insertData.dispositivo_usuario || 'admin',
      dispositivo_password: insertData.dispositivo_password || '',
      tipo: insertData.tipo || 'control_acceso',
      esta_online: true,
      sn_serie: insertData.sn_serie || insertData.sn_serial || 'UNKNOWN',
      estado: insertData.estado || 'operativo',
      configuracion_tecnica: insertData.configuracion_tecnica || {
        marca: insertData.marca || 'Hikvision',
        modelo: insertData.modelo || '',
        puerto: insertData.puerto_servicio || 80
      }
    };

    const { data, error } = await this.supabase
      .getClient()
      .from('dispositivos_iot')
      .insert([payload])
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

  async controlPuerta(ip: string, doorId: number = 1, command: 'abrir' | 'cerrar' | 'siempre-abierta' | 'siempre-cerrada'): Promise<any> {
    const endpointMap = {
      'abrir': `/puerta/${doorId}`,
      'cerrar': `/puerta/${doorId}/cerrar`,
      'siempre-abierta': `/puerta/${doorId}/siempre-abierta`,
      'siempre-cerrada': `/puerta/${doorId}/siempre-cerrada`
    };
    return this.proxyRequestDynamic(ip, 'post', endpointMap[command]);
  }

  async getSnapshot(ip: string): Promise<Buffer> {
    const url = `${this.proxyUrl}/snapshot`;
    try {
      const response = await axios.get(url, {
        headers: { 
          'X-API-Key': this.apiKey,
          'X-Target-IP': ip 
        },
        responseType: 'arraybuffer',
        timeout: 10000,
      });
      return response.data;
    } catch (error) {
      this.logger.error(`❌ [SNAPSHOT] Error: ${error.message}`);
      throw error;
    }
  }

  async syncUsuariosHardware(ip: string): Promise<any> {
    return this.proxyRequestDynamic(ip, 'get', '/usuarios');
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
    port?: string
  ): Promise<boolean> {
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
            'Accept': '*/*'
          }
        });
        
        const existingRules = checkResponse.data || [];
        const ruleExists = existingRules.some((rule: any) => 
          rule['to-addresses'] === deviceLocalIp && 
          String(rule['dst-port']) === String(publicPort)
        );
        
        if (ruleExists) {
          this.logger.log(`ℹ️ [NAT RULE] Regla NAT ya existente en MikroTik para ${deviceLocalIp} -> puerto ${publicPort}`);
          return true;
        }
        
        const payload = {
          chain: 'dstnat',
          action: 'dst-nat',
          protocol: 'tcp',
          'dst-port': String(publicPort),
          'to-addresses': deviceLocalIp,
          'to-ports': '80',
          comment: `Proliseg IoT NAT: ${deviceLocalIp}`
        };
        
        await axios.post(url, payload, {
          auth: { username, password },
          httpsAgent,
          timeout: 10000,
          headers: {
            'User-Agent': 'curl/7.74.0',
            'Accept': '*/*'
          }
        });
        
        this.logger.log(`✅ [NAT MAPPING] Regla NAT agregada con éxito para ${deviceLocalIp} -> puerto ${publicPort}`);
        return true;
        
      } catch (err) {
        errorMsg = err.message;
        this.logger.error(`❌ [NAT MAPPING ERROR] (${protocol}): ${err.message}`);
      }
    }
    
    throw new Error(`No se pudo crear la regla NAT en el MikroTik: ${errorMsg}`);
  }

  async validateCredentials(ip: string, user: string, pass: string): Promise<any> {
    const url = `${this.proxyUrl}/validate`;
    try {
      const response = await axios.post(url, {}, {
        headers: { 
          'X-API-Key': this.apiKey,
          'X-Target-IP': ip,
          'X-Target-User': user,
          'X-Target-Pass': pass
        },
        timeout: 10000
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
    return this.proxyRequestDynamic(ip, 'post', '/isapi', body, { path: isapiPath });
  }

  private async proxyRequestDynamic(
    targetIp: string, 
    method: string, 
    path: string, 
    data: any = null,
    params: any = {}
  ): Promise<any> {
    const query = new URLSearchParams(params).toString();
    const url = `${this.proxyUrl}${path}${query ? '?' + query : ''}`;
    
    try {
      const config: any = { 
        method, 
        url, 
        headers: { 
          'X-API-Key': this.apiKey,
          'X-Target-IP': targetIp
        }, 
        timeout: 20000 
      };
      if (data) config.data = data;
      
      const response = await axios(config);
      return response.data;
    } catch (error) {
      this.logger.error(`❌ [DYNAMIC PROXY ERROR] ${targetIp} -> ${path}: ${error.message}`);
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
