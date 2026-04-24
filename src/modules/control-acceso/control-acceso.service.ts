import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as crypto from 'crypto';

@Injectable()
export class ControlAccesoService {
  private readonly logger = new Logger(ControlAccesoService.name);

  // Configuración base (Esto debería venir de una base de datos de dispositivos en el futuro)
  private readonly baseUrl = 'http://10.0.0.2:8117';
  private readonly user = 'admin';
  private readonly pass = 'prolivilla#';

  /**
   * Abre una puerta específica enviando el comando XML vía ISAPI con Digest Auth
   */
  async abrirPuerta(doorId: number = 1): Promise<any> {
    const url = `${this.baseUrl}/ISAPI/AccessControl/RemoteControl/door/${doorId}`;
    const xmlBody = `
      <RemoteControlDoor xmlns="http://www.isapi.org/ver20/XMLSchema" version="2.0">
        <remoteControlDoor>open</remoteControlDoor>
      </RemoteControlDoor>
    `.trim();

    try {
      return await this.makeDigestRequest('PUT', url, xmlBody);
    } catch (error) {
      this.logger.error(`Error al abrir puerta ${doorId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtiene la información del dispositivo
   */
  async getDeviceInfo(): Promise<any> {
    const url = `${this.baseUrl}/ISAPI/System/deviceInfo`;
    return this.makeDigestRequest('GET', url);
  }

  /**
   * Captura una imagen en vivo de la cámara del terminal
   */
  async getSnapshot(): Promise<Buffer> {
    const url = `${this.baseUrl}/ISAPI/Streaming/channels/101/picture`;
    try {
      return await this.makeDigestRequest('GET', url, undefined, 'arraybuffer');
    } catch (error) {
      this.logger.error(`Error al obtener snapshot: ${error.message}`);
      throw error;
    }
  }

  /**
   * Helper para realizar peticiones con Digest Authentication
   */
  private async makeDigestRequest(method: string, url: string, data?: string, responseType: any = 'json'): Promise<any> {
    try {
      // 1. Primer intento sin auth para obtener el challenge (401)
      await axios({ method, url, data, responseType });
    } catch (error) {
      if (error.response?.status === 401) {
        const authHeader = error.response.headers['www-authenticate'];
        const digestParams = this.parseDigestHeader(authHeader);
        
        // 2. Calcular respuesta Digest
        const nc = '00000001';
        const cnonce = crypto.randomBytes(8).toString('hex');
        const realm = digestParams.realm;
        const nonce = digestParams.nonce;
        const qop = digestParams.qop;
        const uri = new URL(url).pathname;

        const ha1 = this.md5(`${this.user}:${realm}:${this.pass}`);
        const ha2 = this.md5(`${method.toUpperCase()}:${uri}`);
        const response = this.md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`);

        const authValue = `Digest username="${this.user}", realm="${realm}", nonce="${nonce}", uri="${uri}", qop=${qop}, nc=${nc}, cnonce="${cnonce}", response="${response}", opaque="${digestParams.opaque || ''}"`;

        // 3. Segundo intento con el header de Authorization
        const finalResponse = await axios({
          method,
          url,
          data,
          responseType,
          headers: {
            'Authorization': authValue,
            'Content-Type': data ? 'application/xml' : undefined,
          },
        });
        return finalResponse.data;
      }
      throw error;
    }
  }

  private md5(str: string): string {
    return crypto.createHash('md5').update(str).digest('hex');
  }

  private parseDigestHeader(header: string): any {
    const params: any = {};
    const parts = header.replace('Digest ', '').split(', ');
    parts.forEach(part => {
      const [key, value] = part.split('=');
      params[key] = value.replace(/"/g, '');
    });
    return params;
  }
}
