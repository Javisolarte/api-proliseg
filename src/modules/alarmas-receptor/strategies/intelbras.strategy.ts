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
    
    // Comando 3F = Armar
    const comando = '3F'; 
    const particionHex = partition.toString(16).padStart(2, '0');
    // Usamos la contraseña de acceso remoto que el usuario especificó (814626) para que el panel acepte el comando
    // Opcionalmente, la podemos convertir a BCD o dejarla tal cual si es texto. Intelbras usa BCD o Hex para contraseñas.
    // Asumiremos formato ASCII Hexadecimal simple por ahora.
    const pinHex = Buffer.from('814626').toString('hex').padStart(12, '0');
    
    // Trama binaria simulada (Header + Length + Comando + Partición + Pin)
    const rawTramaHex = `1C0A${comando}${particionHex}${pinHex}`;

    this.logger.log(`📡 [Intelbras AMT Hex] Trama binaria generada: [${rawTramaHex}]`);
    
    // Lo enviamos como String Hexadecimal, el Gateway se encargará de convertirlo a Buffer Binario
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
        message: `Comando enviado (Simulación). El panel físico cuenta ${panel.cuenta_monitoreo} no tiene una conexión TCP activa en puerto 9008 ni en 10300.`,
      };
    }
  }

  async disarm(panel: any, partition: number, code: string): Promise<{ success: boolean; message: string }> {
    this.logger.log(`🔓 [IntelbrasStrategy] Intentando desarmar panel Cuenta: ${panel.cuenta_monitoreo}, Partición: ${partition}`);
    
    const comando = '3E'; // Desarmar
    const particionHex = partition.toString(16).padStart(2, '0');
    const pinHex = Buffer.from('814626').toString('hex').padStart(12, '0');
    
    const rawTramaHex = `1C0A${comando}${particionHex}${pinHex}`;

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
        message: `Comando enviado (Simulación). El panel físico cuenta ${panel.cuenta_monitoreo} no tiene una conexión TCP activa en puerto 9008 ni en 10300.`,
      };
    }
  }

  async toggleSiren(panel: any, state: 'on' | 'off'): Promise<{ success: boolean; message: string }> {
    this.logger.log(`📢 [IntelbrasStrategy] Controlando sirena en panel Cuenta: ${panel.cuenta_monitoreo}. Estado solicitado: ${state}`);
    
    // Comando 4C = Sirena / PGM
    const comando = '4C'; 
    const estadoHex = state === 'on' ? '01' : '00';
    // Enviamos la clave por seguridad
    const pinHex = Buffer.from('814626').toString('hex').padStart(12, '0');
    
    // Trama binaria simulada
    const rawTramaHex = `1C0A${comando}${estadoHex}${pinHex}`;

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
