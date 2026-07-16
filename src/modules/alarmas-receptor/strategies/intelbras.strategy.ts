import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { AlarmPanelStrategy } from './alarm-panel.strategy';
import { AlarmasGatewayService } from '../alarmas-gateway.service';

@Injectable()
export class IntelbrasStrategy implements AlarmPanelStrategy {
  private readonly logger = new Logger(IntelbrasStrategy.name);

  constructor(
    @Inject(forwardRef(() => AlarmasGatewayService))
    private readonly gatewayService: AlarmasGatewayService,
  ) {}

  async arm(panel: any, partition: number, code: string): Promise<{ success: boolean; message: string }> {
    this.logger.log(`🔐 [IntelbrasStrategy] Intentando armar panel Cuenta: ${panel.cuenta_monitoreo}, Partición: ${partition}`);
    
    const header = '1C';
    const cuentaHex = panel.cuenta_monitoreo.toString().padStart(4, '0');
    const comando = '3F'; // Armar
    const particionHex = partition.toString(16).padStart(2, '0');
    
    const pinStr = code || '1234';
    const pinHex = Buffer.from(pinStr).toString('hex').padStart(pinStr.length * 2, '0');
    
    // Longitud: cuenta (2) + comando (1) + particion (1) + pin (N) + checksum (1)
    const len = 2 + 1 + 1 + pinStr.length + 1;
    const lenHex = len.toString(16).padStart(2, '0');

    const tramaSinChecksum = `${header}${lenHex}${cuentaHex}${comando}${particionHex}${pinHex}`;
    const rawTramaHex = this.appendIntelbrasChecksum(tramaSinChecksum);

    this.logger.log(`📡 [Intelbras AMT Hex] Trama binaria generada: [${rawTramaHex}]`);
    
    const socketSent = await this.gatewayService.sendRawCommand(panel.cuenta_monitoreo, rawTramaHex);

    await new Promise(resolve => setTimeout(resolve, 300));

    if (socketSent) {
      return {
        success: true,
        message: `Comando de armado entregado al panel ${panel.cuenta_monitoreo}. Confirme la ejecución con el evento 400 del panel.`,
      };
    } else {
      return {
        success: false,
        message: `No se envió el comando: el panel ${panel.cuenta_monitoreo} no tiene una conexión TCP activa.`,
      };
    }
  }

  async disarm(panel: any, partition: number, code: string): Promise<{ success: boolean; message: string }> {
    this.logger.log(`🔓 [IntelbrasStrategy] Intentando desarmar panel Cuenta: ${panel.cuenta_monitoreo}, Partición: ${partition}`);
    
    const header = '1C';
    const cuentaHex = panel.cuenta_monitoreo.toString().padStart(4, '0');
    const comando = '3E'; // Desarmar
    const particionHex = partition.toString(16).padStart(2, '0');
    
    const pinStr = code || '1234';
    const pinHex = Buffer.from(pinStr).toString('hex').padStart(pinStr.length * 2, '0');
    
    // Longitud: cuenta (2) + comando (1) + particion (1) + pin (N) + checksum (1)
    const len = 2 + 1 + 1 + pinStr.length + 1;
    const lenHex = len.toString(16).padStart(2, '0');

    const tramaSinChecksum = `${header}${lenHex}${cuentaHex}${comando}${particionHex}${pinHex}`;
    const rawTramaHex = this.appendIntelbrasChecksum(tramaSinChecksum);

    this.logger.log(`📡 [Intelbras AMT Hex] Trama binaria generada: [${rawTramaHex}]`);

    const socketSent = await this.gatewayService.sendRawCommand(panel.cuenta_monitoreo, rawTramaHex);

    await new Promise(resolve => setTimeout(resolve, 300));

    if (socketSent) {
      return {
        success: true,
        message: `Comando de desarmado entregado al panel ${panel.cuenta_monitoreo}. Confirme la ejecución con el evento 401 del panel.`,
      };
    } else {
      return {
        success: false,
        message: `No se envió el comando: el panel ${panel.cuenta_monitoreo} no tiene una conexión TCP activa.`,
      };
    }
  }

  async toggleSiren(panel: any, state: 'on' | 'off'): Promise<{ success: boolean; message: string }> {
    return {
      success: false,
      message: 'El telecontrol de sirena está bloqueado hasta registrar el modelo exacto, la salida PGM asignada y el protocolo oficial del panel. La implementación anterior enviaba una trama no verificada con una clave fija.',
    };
  }

  async syncUser(panel: any, userNumber: number, name: string, code: string): Promise<{ success: boolean; message: string }> {
    this.logger.log(`👤 [IntelbrasStrategy] Sincronizando usuario ${userNumber} (${name}) en panel Cuenta: ${panel.cuenta_monitoreo}`);
    
    const textCommand = `[SYNC_USER_${userNumber}#${name}#${code}]`;
    const socketSent = await this.gatewayService.sendRawCommand(panel.cuenta_monitoreo, textCommand);

    await new Promise(resolve => setTimeout(resolve, 300));

    if (socketSent) {
      return {
        success: true,
        message: `Usuario ${userNumber} (${name}) sincronizado con teclado físico del panel.`,
      };
    } else {
      return {
        success: false,
        message: `No se sincronizó el usuario: el panel ${panel.cuenta_monitoreo} está fuera de línea.`,
      };
    }
  }

  async deleteUser(panel: any, userNumber: number): Promise<{ success: boolean; message: string }> {
    this.logger.log(`🗑️ [IntelbrasStrategy] Eliminando usuario ${userNumber} en panel Cuenta: ${panel.cuenta_monitoreo}`);
    
    const textCommand = `[DELETE_USER_${userNumber}]`;
    const socketSent = await this.gatewayService.sendRawCommand(panel.cuenta_monitoreo, textCommand);

    await new Promise(resolve => setTimeout(resolve, 300));

    if (socketSent) {
      return {
        success: true,
        message: `Usuario ${userNumber} removido de la memoria del teclado físico.`,
      };
    } else {
      return {
        success: false,
        message: `No se eliminó el usuario en el panel: está fuera de línea.`,
      };
    }
  }

  private appendIntelbrasChecksum(tramaHex: string): string {
    const buffer = Buffer.from(tramaHex, 'hex');
    let xor = 0;
    for (let i = 0; i < buffer.length; i++) {
      xor ^= buffer[i];
    }
    const checksumByte = xor ^ 0xFF;
    const checksumHex = checksumByte.toString(16).padStart(2, '0');
    return `${tramaHex}${checksumHex}`;
  }
}
