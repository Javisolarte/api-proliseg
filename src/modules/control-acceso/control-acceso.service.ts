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

  async createDispositivo(dto: CreateDispositivoDto) {
    const { data, error } = await this.supabase
      .getClient()
      .from('dispositivos_iot')
      .insert([dto])
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

  async scanNetwork(range: string): Promise<any[]> {
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
}
