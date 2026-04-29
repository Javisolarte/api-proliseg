import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateDispositivoDto, CreatePersonaAccesoDto } from './dto/control-acceso.dto';

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
}
