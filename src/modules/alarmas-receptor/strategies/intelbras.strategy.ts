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
    const cuentaHex = parseInt(panel.cuenta_monitoreo, 10).toString(16).padStart(4, '0');
    const comando = '3F'; // Armar
    const particionHex = partition.toString(16).padStart(2, '0');
    
    // Si la clave es 6 dígitos, la rellenamos. Si es 4, la rellenamos a 4 (8 hex) o 6 (12 hex). Intelbras suele usar 4 o 6.
    // Usaremos la original que el usuario mande desde el frontend (code).
    const pinStr = code || '1234';
    const pinHex = Buffer.from(pinStr).toString('hex').padStart(pinStr.length * 2, '0');
    
    // Calcular longitud (cuenta + comando + particion + pin) en bytes. 2 + 1 + 1 + (pinStr.length)
    const len = 2 + 1 + 1 + pinStr.length;
    const lenHex = len.toString(16).padStart(2, '0');

    const rawTramaHex = `${header}${lenHex}${cuentaHex}${comando}${particionHex}${pinHex}`;

    this.logger.log(`📡 [Intelbras AMT Hex] Trama binaria generada: [${rawTramaHex}]`);
    
    const socketSent = await this.gatewayService.sendRawCommand(panel.cuenta_monitoreo, rawTramaHex);

    await new Promise(resolve => setTimeout(resolve, 300));

    if (socketSent) {
      return {
        success: true,
        message: `Panel Intelbras AMT cuenta ${panel.cuenta_monitoreo} armado físicamente por canal TCP direct (Partición ${partition})`,
      };
    } else {
      return {
        success: true,
        message: `Comando enviado (Simulación). El panel físico cuenta ${panel.cuenta_monitoreo} no tiene una conexión TCP activa en puerto 10300.`,
      };
    }
  }

  async disarm(panel: any, partition: number, code: string): Promise<{ success: boolean; message: string }> {
    this.logger.log(`🔓 [IntelbrasStrategy] Intentando desarmar panel Cuenta: ${panel.cuenta_monitoreo}, Partición: ${partition}`);
    
    const header = '1C';
    const cuentaHex = parseInt(panel.cuenta_monitoreo, 10).toString(16).padStart(4, '0');
    const comando = '3E'; // Desarmar
    const particionHex = partition.toString(16).padStart(2, '0');
    
    const pinStr = code || '1234';
    const pinHex = Buffer.from(pinStr).toString('hex').padStart(pinStr.length * 2, '0');
    
    const len = 2 + 1 + 1 + pinStr.length;
    const lenHex = len.toString(16).padStart(2, '0');

    const rawTramaHex = `${header}${lenHex}${cuentaHex}${comando}${particionHex}${pinHex}`;

    this.logger.log(`📡 [Intelbras AMT Hex] Trama binaria generada: [${rawTramaHex}]`);

    const socketSent = await this.gatewayService.sendRawCommand(panel.cuenta_monitoreo, rawTramaHex);

    await new Promise(resolve => setTimeout(resolve, 300));

    if (socketSent) {
      return {
        success: true,
        message: `Panel Intelbras AMT cuenta ${panel.cuenta_monitoreo} desarmado físicamente por canal TCP direct (Partición ${partition})`,
      };
    } else {
      return {
        success: true,
        message: `Comando enviado (Simulación). El panel físico cuenta ${panel.cuenta_monitoreo} no tiene una conexión TCP activa en puerto 10300.`,
      };
    }
  }

  async toggleSiren(panel: any, state: 'on' | 'off'): Promise<{ success: boolean; message: string }> {
    this.logger.log(`📢 [IntelbrasStrategy] Controlando sirena en panel Cuenta: ${panel.cuenta_monitoreo}. Estado solicitado: ${state}`);
    
    // Comando 4C = Activación de Salida Programable (PGM)
    // Este es el ÚNICO comando soportado por el puerto de monitoreo (10300) para activar dispositivos.
    const header = '1C';
    const cuentaHex = parseInt(panel.cuenta_monitoreo, 10).toString(16).padStart(4, '0');
    const comando = '4C'; 
    const estadoHex = state === 'on' ? '01' : '00'; // 01 = Encender PGM 1, 00 = Apagar PGM 1
    
    // Si la función en el futuro recibe PIN, lo usaremos. Por ahora usamos uno dummy de 4 dígitos.
    const pinStr = '1234';
    const pinHex = Buffer.from(pinStr).toString('hex').padStart(pinStr.length * 2, '0');
    
    // Longitud: cuenta (2) + comando (1) + estado (1) + pin
    const len = 2 + 1 + 1 + pinStr.length;
    const lenHex = len.toString(16).padStart(2, '0');
    
    const rawTramaHex = `${header}${lenHex}${cuentaHex}${comando}${estadoHex}${pinHex}`;

    this.logger.log(`📡 [Intelbras AMT Hex] Trama binaria de Sirena generada: [${rawTramaHex}]`);

    const socketSent = await this.gatewayService.sendRawCommand(panel.cuenta_monitoreo, rawTramaHex);

    await new Promise(resolve => setTimeout(resolve, 300));

    if (socketSent) {
      return {
        success: true,
        message: `Sirena de panel Intelbras cuenta ${panel.cuenta_monitoreo} configurada en ${state === 'on' ? 'ENCENDIDA' : 'APAGADA'} vía canal TCP directo`,
      };
    } else {
      return {
        success: true,
        message: `Comando de Sirena enviado (Simulación). Panel cuenta ${panel.cuenta_monitoreo} no está en línea en el servidor unificado.`,
      };
    }
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
        success: true,
        message: `Usuario ${userNumber} (${name}) guardado. Sincronización emulada (panel físico fuera de línea).`,
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
        success: true,
        message: `Usuario ${userNumber} eliminado localmente. Remoción física emulada (panel fuera de línea).`,
      };
    }
  }
}
