import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject, forwardRef } from '@nestjs/common';
import * as net from 'net';
import { DevicePollerService } from '../control-acceso/device-poller.service';
import { SupabaseService } from '../supabase/supabase.service';
import { AlarmasReceptorService } from './alarmas-receptor.service';

@Injectable()
export class AlarmasGatewayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AlarmasGatewayService.name);
  private server: net.Server | null = null;
  private readonly port = 9008;

  // Mapa en memoria para almacenar los sockets activos asociados a la cuenta de monitoreo
  private activeSockets = new Map<string, net.Socket>();
  // Mapa para rastrear el ID del panel asociado a cada cuenta
  private cuentaToPanelId = new Map<string, string>();

  constructor(
    private readonly supabase: SupabaseService,
    @Inject(forwardRef(() => DevicePollerService))
    private readonly devicePoller: DevicePollerService,
    @Inject(forwardRef(() => AlarmasReceptorService))
    private readonly alarmasReceptor: AlarmasReceptorService,
  ) {}

  onModuleInit() {
    this.startServer();
  }

  onModuleDestroy() {
    this.stopServer();
  }

  private startServer() {
    this.server = net.createServer((socket) => {
      let clientAccount: string | null = null;

      this.logger.log(`🔌 [Gateway TCP] Nueva conexión entrante desde ${socket.remoteAddress}:${socket.remotePort}`);

      socket.on('data', async (data) => {
        const rawString = data.toString('utf-8').trim();
        const hexString = data.toString('hex');
        this.logger.log(`📥 [Gateway TCP] Datos recibidos (HEX): ${hexString}`);
        
        // 1. Decodificar Login de Intelbras AMT / Simulador
        // Formato estándar de prueba: [LOGIN#2002] o trama binaria de Intelbras conteniendo la cuenta
        if (rawString.startsWith('[LOGIN#') && rawString.endsWith(']')) {
          const account = rawString.substring(7, rawString.length - 1).trim();
          clientAccount = account;
          
          this.activeSockets.set(account, socket);
          this.logger.log(`🔑 [Gateway TCP] Panel cuenta ${account} AUTENTICADO con éxito.`);
          
          // Responder con ACK al panel
          socket.write(Buffer.from([0x06])); // ACK

          // Buscar el panel_id en base de datos
          await this.syncPanelConnectionState(account, true);
          return;
        }

        // 2. Procesar trama de Heartbeat / Keep-Alive
        // Intelbras AMT envía tramas de control periódicas (ej. Byte 0x11 o mensaje [PING])
        if (rawString === '[PING]' || data.length === 1 && data[0] === 0x11) {
          if (clientAccount) {
            // Responder con Keep-Alive ACK / Pong (ej. Byte 0x12 o [PONG])
            if (rawString === '[PING]') {
              socket.write('[PONG]');
            } else {
              socket.write(Buffer.from([0x12]));
            }
            this.logger.debug(`💓 [Gateway TCP] Heartbeat recibido de cuenta ${clientAccount}`);
          }
          return;
        }

        // Otras tramas o respuestas de comandos
        this.logger.log(`📥 [Gateway TCP] Datos recibidos de cuenta ${clientAccount || 'Desconocido'}: ${rawString}`);
      });

      const handleClose = async () => {
        if (clientAccount) {
          this.activeSockets.delete(clientAccount);
          this.logger.warn(`🔌 [Gateway TCP] Panel cuenta ${clientAccount} desconectado.`);
          await this.syncPanelConnectionState(clientAccount, false);
        }
      };

      socket.on('end', handleClose);
      socket.on('close', handleClose);

      socket.on('error', (err) => {
        this.logger.error(`⚠️ [Gateway TCP] Error en socket cuenta ${clientAccount || 'Desconocido'}: ${err.message}`);
      });
    });

    this.server.listen(this.port, '0.0.0.0', () => {
      this.logger.log(`🚀 [Gateway TCP] Servidor bidireccional escuchando en puerto ${this.port}`);
    });
  }

  private stopServer() {
    if (this.server) {
      this.activeSockets.forEach((socket) => socket.destroy());
      this.activeSockets.clear();
      this.server.close(() => {
        this.logger.log(`🛑 [Gateway TCP] Servidor bidireccional apagado.`);
      });
    }
  }

  // ─── API PÚBLICA DE CONTROL ───────────────────────────────────────────────

  /**
   * Retorna si la cuenta de alarma tiene un socket TCP activo
   */
  isPanelConnected(cuenta: string): boolean {
    return this.activeSockets.has(cuenta);
  }

  /**
   * Envía un comando en bruto (bytes/string) al panel físico
   */
  public async sendRawCommand(account: string, commandString: string): Promise<boolean> {
    const localSocket = this.activeSockets.get(account);
    if (localSocket) {
      localSocket.write(commandString);
      this.logger.log(`📤 [Gateway TCP] Comando enviado a cuenta ${account} vía Gateway Local (9008): ${commandString}`);
      return true;
    }

    // Si no está en el Gateway 9008, pedir el socket unificado del puerto 10300 (Intelbras Nativo)
    const receptorSocket = this.alarmasReceptor.getIntelbrasSocket(account);
    if (receptorSocket) {
      // Como el comando puede venir en Hexadecimal (para Intelbras), comprobamos si parece Hex
      if (/^[0-9a-fA-F]+$/.test(commandString)) {
        receptorSocket.write(Buffer.from(commandString, 'hex'));
        this.logger.log(`📤 [Gateway TCP -> Receptora] Comando Binario enviado a cuenta ${account} vía Receptora (10300): [${commandString}]`);
      } else {
        receptorSocket.write(commandString);
        this.logger.log(`📤 [Gateway TCP -> Receptora] Comando ASCII enviado a cuenta ${account} vía Receptora (10300): ${commandString}`);
      }
      return true;
    }

    this.logger.warn(`⚠️ [Gateway TCP] Intento de comando a cuenta ${account} fallido. No hay socket local ni en receptora.`);
    return false;
  }

  /**
   * Sincroniza y emite el estado de conexión del panel en tiempo real
   */
  private async syncPanelConnectionState(cuenta: string, conectado: boolean) {
    try {
      const db = this.supabase.getClient();
      
      // Buscar ID del panel
      let panelId = this.cuentaToPanelId.get(cuenta);
      if (!panelId) {
        const { data: panel } = await db
          .from('alarmas_paneles')
          .select('id')
          .eq('cuenta_monitoreo', cuenta)
          .maybeSingle();
        if (panel?.id) {
          panelId = panel.id;
          this.cuentaToPanelId.set(cuenta, panel.id);
        }
      }

      if (panelId) {
        // Emitir cambio de estado vía WebSocket global a todos los navegadores
        const eventoEstado = {
          dispositivo_id: panelId,
          nombre_dispositivo: `Panel ${cuenta}`,
          tipo_evento: 'panel_status',
          metodo_acceso: 'remoto',
          nombre_persona: conectado ? 'Conectado' : 'Desconectado',
          documento_persona: 'ESTADO',
          codigo_tarjeta: conectado ? 'CONECTADO' : 'DESCONECTADO',
          timestamp: new Date().toISOString(),
          detalles_raw: {
            cuenta,
            panel_id: panelId,
            conectado: conectado
          }
        };

        this.devicePoller.saveAndEmit(eventoEstado as any);
        this.logger.log(`📡 [Gateway TCP] Estado de conexión de cuenta ${cuenta} emitido en tiempo real: ${conectado ? 'Conectado' : 'Desconectado'}`);
      }
    } catch (err) {
      this.logger.error(`Error in syncPanelConnectionState: ${err.message}`);
    }
  }
}
