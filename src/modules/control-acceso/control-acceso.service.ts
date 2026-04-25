import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateDispositivoDto, CreatePersonaAccesoDto } from './dto/control-acceso.dto';

@Injectable()
export class ControlAccesoService {
  private readonly logger = new Logger(ControlAccesoService.name);

  // Proxy de Hikvision corriendo en Ubuntu bajo subdominio corporativo
  private readonly proxyUrl = 'https://acceso.proliseg.com/puerta';
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

  async findAllLogs() {
    const { data, error } = await this.supabase
      .getClient()
      .from('dispositivos_eventos_historico')
      .select('*, dispositivo:dispositivos_iot(nombre_identificador), persona:personas_gestion_acceso(nombre_completo)')
      .order('timestamp', { ascending: false });
    if (error) throw error;
    return data;
  }

  /**
   * PROXY METHODS (HARDWARE)
   */

  async abrirPuerta(doorId: number = 1): Promise<any> {
    return this.proxyRequest('post', `/abrir/${doorId}`);
  }

  async cerrarPuerta(doorId: number = 1): Promise<any> {
    return this.proxyRequest('post', `/cerrar/${doorId}`);
  }

  async siempreAbierta(doorId: number = 1, activar: boolean = true): Promise<any> {
    const action = activar ? 'true' : 'false';
    return this.proxyRequest('post', `/siempre-abierta/${doorId}?active=${action}`);
  }

  private async proxyRequest(method: string, path: string, data: any = null): Promise<any> {
    const url = `${this.proxyUrl}${path}`;
    this.logger.log(`🚀 [PROXY REQUEST] ${method.toUpperCase()} ${url}`);
    try {
      const config: any = { method, url, headers: { 'X-API-Key': this.apiKey }, timeout: 15000 };
      if (data) config.data = data;
      
      const response = await axios(config);
      return response.data;
    } catch (error) {
      this.logger.error(`❌ [PROXY ERROR] ${path}: ${error.message}`);
      throw error;
    }
  }

  // ===================================
  // NUEVOS MÉTODOS DE DESCUBRIMIENTO
  // ===================================
  async escanearRed(baseIp?: string): Promise<any> {
    if (baseIp) {
      return this.proxyRequest('get', `/scan?base=${baseIp}`);
    }

    // Escaneo Total Optimizado (Rangos de 1 a 254 en lotes de 15 para no saturar memoria)
    this.logger.log('🌐 Iniciando barrido total de redes 192.168.1.x a 192.168.254.x');
    const allFound: any[] = [];
    const segments: string[] = [];
    for (let i = 1; i < 255; i++) {
      segments.push(`192.168.${i}`);
    }

    // Lotes paralelos de 15 subredes (Aprox. 1.2 segundos por lote, total ~20 segundos)
    for (let i = 0; i < segments.length; i += 15) {
      const batch = segments.slice(i, i + 15);
      const promises = batch.map(seg => 
        this.proxyRequest('get', `/scan?base=${seg}`).catch(() => null)
      );
      
      const results = await Promise.all(promises);
      results.forEach(res => {
        if (res && res.found && res.found.length > 0) {
          allFound.push(...res.found);
        }
      });
    }
    
    this.logger.log(`✅ Barrido completo finalizado. Dispositivos encontrados: ${allFound.length}`);
    return { target: '192.168.ALL', found: allFound };
  }

  async validarEquipo(ip: string, user: string, pass: string): Promise<any> {
    return this.proxyRequest('post', '/validate', { ip, user, password: pass });
  }

  async getDeviceInfo(): Promise<any> {
    return this.proxyRequest('get', '/info');
  }

  async getSnapshot(): Promise<Buffer> {
    const url = `${this.proxyUrl}/snapshot`;
    try {
      const response = await axios.get(url, {
        headers: { 'X-API-Key': this.apiKey },
        responseType: 'arraybuffer',
        timeout: 10000,
      });
      return response.data;
    } catch (error) {
      this.logger.error(`❌ [SNAPSHOT] Error: ${error.message}`);
      throw error;
    }
  }
}
