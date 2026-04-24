import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class ControlAccesoService {
  private readonly logger = new Logger(ControlAccesoService.name);

  // Proxy de Hikvision corriendo en Ubuntu (maneja Digest Auth internamente)
  private readonly proxyUrl = 'http://137.131.171.90:3500';
  private readonly apiKey = 'proliseg-acceso-2026';

  /**
   * Abre una puerta específica a través del proxy de Ubuntu
   */
  async abrirPuerta(doorId: number = 1): Promise<any> {
    const url = `${this.proxyUrl}/abrir/${doorId}`;

    this.logger.warn(`🚀 [ABRIR PUERTA ${doorId}] Enviando solicitud al proxy Ubuntu...`);
    this.logger.log(`📍 URL Proxy: ${url}`);

    try {
      const response = await axios.post(url, {}, {
        headers: { 'X-API-Key': this.apiKey },
        timeout: 10000,
      });

      this.logger.log(`✅ [ABRIR PUERTA ${doorId}] Respuesta del proxy: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      this.logger.error(`❌ [ABRIR PUERTA ${doorId}] Error: ${error.message}`);
      if (error.response) {
        this.logger.error(`   HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`);
      }
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
