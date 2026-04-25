import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class ControlAccesoService {
  private readonly logger = new Logger(ControlAccesoService.name);

  // Proxy de Hikvision corriendo en Ubuntu bajo subdominio corporativo
  private readonly proxyUrl = 'https://acceso.proliseg.com/puerta';
  private readonly apiKey = 'proliseg-acceso-2026';

  /**
   * Abre una puerta específica a través del proxy de Ubuntu
   */
  async abrirPuerta(doorId: number = 1): Promise<any> {
    return this.proxyRequest('post', `/abrir/${doorId}`);
  }

  async cerrarPuerta(doorId: number = 1): Promise<any> {
    return this.proxyRequest('post', `/cerrar/${doorId}`);
  }

  async siempreAbierta(doorId: number = 1): Promise<any> {
    return this.proxyRequest('post', `/siempre-abierta/${doorId}`);
  }

  private async proxyRequest(method: string, path: string): Promise<any> {
    const url = `${this.proxyUrl}${path}`;
    this.logger.log(`🚀 [PROXY REQUEST] ${method.toUpperCase()} ${url}`);
    try {
      const response = await axios({ method, url, headers: { 'X-API-Key': this.apiKey }, timeout: 10000 });
      return response.data;
    } catch (error) {
      this.logger.error(`❌ [PROXY ERROR] ${path}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtiene la información del dispositivo a través del proxy
   */
  async getDeviceInfo(): Promise<any> {
    const url = `${this.proxyUrl}/info`;

    this.logger.log(`📡 [DEVICE INFO] Solicitando info del dispositivo...`);

    try {
      const response = await axios.get(url, {
        headers: { 'X-API-Key': this.apiKey },
        timeout: 10000,
      });

      this.logger.log(`✅ [DEVICE INFO] Respuesta recibida (${typeof response.data === 'string' ? response.data.length : 0} chars)`);
      return response.data;
    } catch (error) {
      this.logger.error(`❌ [DEVICE INFO] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Captura una imagen en vivo de la cámara a través del proxy
   */
  async getSnapshot(): Promise<Buffer> {
    const url = `${this.proxyUrl}/snapshot`;

    try {
      const response = await axios.get(url, {
        headers: { 'X-API-Key': this.apiKey },
        responseType: 'arraybuffer',
        timeout: 10000,
      });

      this.logger.debug(`📸 [SNAPSHOT] Imagen recibida: ${response.data.length} bytes`);
      return response.data;
    } catch (error) {
      this.logger.error(`❌ [SNAPSHOT] Error: ${error.message}`);
      throw error;
    }
  }
}
