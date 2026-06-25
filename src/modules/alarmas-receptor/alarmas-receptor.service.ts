import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as net from 'net';
import { SupabaseService } from '../supabase/supabase.service';
import { DevicePollerService, EventoAcceso } from '../control-acceso/device-poller.service';

@Injectable()
export class AlarmasReceptorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AlarmasReceptorService.name);
  private server: net.Server | null = null;
  private readonly port = 10300;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly devicePoller: DevicePollerService,
  ) {}

  onModuleInit() {
    this.startServer();
  }

  onModuleDestroy() {
    this.stopServer();
  }

  private startServer() {
    this.server = net.createServer((socket) => {
      this.logger.log(`📡 [Receptora Alarma] Conexión establecida desde ${socket.remoteAddress}:${socket.remotePort}`);

      socket.on('data', async (data) => {
        const rawString = data.toString('utf-8');
        this.logger.log(`📥 [Receptora Alarma] Paquete recibido: ${rawString}`);

        // 1. Responder con ACK (Hex 06) para que el comunicador no reporte falla
        socket.write(Buffer.from([0x06]));
        this.logger.log(`📤 [Receptora Alarma] ACK enviado.`);

        // 2. Procesar las tramas en el paquete (en caso de que vengan encoladas en corchetes)
        const tramas = rawString.match(/\[([^\]]+)\]/g);
        if (!tramas) {
          this.logger.warn(`⚠️ [Receptora Alarma] Trama con formato inválido o vacía.`);
          return;
        }

        for (const trama of tramas) {
          await this.procesarTrama(trama);
        }
      });

      socket.on('end', () => {
        this.logger.log(`🔌 [Receptora Alarma] Conexión cerrada por el comunicador.`);
      });

      socket.on('error', (err) => {
        this.logger.error(`⚠️ [Receptora Alarma] Error en socket: ${err.message}`);
      });
    });

    this.server.listen(this.port, '0.0.0.0', () => {
      this.logger.log(`🚀 [Receptora Alarma] Servidor TCP escuchando en puerto ${this.port}`);
    });
  }

  private stopServer() {
    if (this.server) {
      this.server.close(() => {
        this.logger.log(`🛑 [Receptora Alarma] Servidor TCP apagado.`);
      });
    }
  }

  private async procesarTrama(tramaRaw: string) {
    try {
      // Remover los corchetes
      const trama = tramaRaw.replace(/[\[\]]/g, '').trim();
      
      let account = '';
      let qualifier = ''; // '1' = Alarma/Apertura, '3' = Restablecimiento/Cierre
      let eventCode = '';
      let partition = '01';
      let zoneOrUser = '000';

      // Parsear formato Sur-Gard con pipe y numeral: e.g. 0001L001004#8844|18113001004
      if (trama.includes('#') && trama.includes('|')) {
        const parts = trama.split('|');
        const headerPart = parts[0];
        const payloadPart = parts[1];

        // Extraer la cuenta después del '#'
        const hashIdx = headerPart.indexOf('#');
        account = headerPart.substring(hashIdx + 1).trim();

        // Parsear el payload (ej: 18113001004)
        if (payloadPart.startsWith('18')) {
          qualifier = payloadPart.charAt(2);       // '1' o '3'
          eventCode = payloadPart.substring(3, 6);  // '130'
          partition = payloadPart.substring(6, 8);  // '01'
          zoneOrUser = payloadPart.substring(8, 11); // '004'
        } else {
          eventCode = payloadPart;
        }
      } else {
        // Formato compacto sin pipe: e.g. 884418113001004
        const idx18 = trama.indexOf('18');
        if (idx18 !== -1 && trama.length >= idx18 + 11) {
          account = trama.substring(0, idx18).trim();
          qualifier = trama.charAt(idx18 + 2);
          eventCode = trama.substring(idx18 + 3, idx18 + 6);
          partition = trama.substring(idx18 + 6, idx18 + 8);
          zoneOrUser = trama.substring(idx18 + 8, idx18 + 11);
        } else {
          account = 'DESCONOCIDA';
          eventCode = trama;
        }
      }

      this.logger.log(`🔔 [Receptora Alarma] Evento decodificado → Cuenta: ${account}, Evento: ${eventCode}, Zona/Usuario: ${zoneOrUser}, Tipo: ${qualifier}`);

      // 3. Buscar el panel de alarma registrado en Supabase
      const db = this.supabase.getClient();
      let { data: panel, error: panelErr } = await db
        .from('alarmas_paneles')
        .select('*')
        .eq('cuenta_monitoreo', account)
        .maybeSingle();

      if (panelErr) throw panelErr;

      let deviceId = null;
      let deviceName = `Cuenta ${account}`;

      // Si no existe el panel registrado en alarmas_paneles, buscamos si hay un dispositivo IoT asociado
      if (!panel) {
        const { data: devices, error: devErr } = await db
          .from('dispositivos_iot')
          .select('*')
          .in('estado', ['operativo', 'mantenimiento']);

        if (!devErr && devices) {
          const matchingDevice = devices.find((d: any) => {
            const cuentaConfig = d.configuracion_tecnica?.cuenta || d.configuracion_tecnica?.account;
            return String(cuentaConfig) === String(account) || String(d.id) === String(account);
          });

          if (matchingDevice) {
            deviceId = matchingDevice.id;
            deviceName = matchingDevice.nombre_identificador;

            // Auto-registrar el panel en la nueva tabla
            const { data: newPanel, error: createErr } = await db
              .from('alarmas_paneles')
              .insert({
                dispositivo_id: deviceId,
                cuenta_monitoreo: account,
                nombre_lugar: matchingDevice.nombre_identificador || `Panel Alarma ${account}`,
                estado_panel: 'activo',
              })
              .select('*')
              .maybeSingle();

            if (!createErr && newPanel) {
              panel = newPanel;
              this.logger.log(`🆕 [Receptora Alarma] Panel auto-registrado para la cuenta ${account}`);
            }
          }
        }
      } else {
        deviceId = panel.dispositivo_id;
        deviceName = panel.nombre_lugar;
      }

      // Si definitivamente no hay panel ni dispositivo IoT, logueamos la advertencia pero guardamos el log huérfano
      if (!panel) {
        this.logger.warn(`⚠️ [Receptora Alarma] Señal de cuenta desconocida: ${account}`);
      }

      // 4. Buscar definición de Contact ID en el catálogo
      const { data: cidInfo } = await db
        .from('alarmas_contact_id_catalogo')
        .select('*')
        .eq('codigo', eventCode)
        .maybeSingle();

      // Mapeo por defecto por si no existe en el catálogo maestro
      const defaultMapping: { [code: string]: { descripcion: string; categoria_defecto: string; prioridad_defecto: string } } = {
        '130': { descripcion: 'Alarma de Robo', categoria_defecto: 'alarma', prioridad_defecto: 'critica' },
        '137': { descripcion: 'Alarma de Sabotaje (Tamper)', categoria_defecto: 'alarma', prioridad_defecto: 'alta' },
        '401': { descripcion: 'Desarmado del Sistema', categoria_defecto: 'apertura', prioridad_defecto: 'informativa' },
        '400': { descripcion: 'Armado del Sistema', categoria_defecto: 'cierre', prioridad_defecto: 'informativa' },
        '602': { descripcion: 'Test Periódico de Comunicación', categoria_defecto: 'test', prioridad_defecto: 'baja' },
        '301': { descripcion: 'Fallo de Energía AC', categoria_defecto: 'fallo', prioridad_defecto: 'media' },
        '302': { descripcion: 'Batería Baja del Panel', categoria_defecto: 'fallo', prioridad_defecto: 'alta' },
      };

      const cid = cidInfo || defaultMapping[eventCode] || {
        descripcion: `Evento Contact ID ${eventCode}`,
        categoria_defecto: 'evento',
        prioridad_defecto: 'media',
      };

      const esRestablecimiento = qualifier === '3';
      const categoriaCid = esRestablecimiento ? 'restablecimiento' : cid.categoria_defecto;

      // 5. Traducir Zona o Usuario
      let nombreElemento = `Zona/Usuario ${zoneOrUser}`;
      
      if (panel) {
        if (categoriaCid === 'apertura' || categoriaCid === 'cierre') {
          // Es un usuario que armó/desarmó
          const { data: userData } = await db
            .from('alarmas_usuarios_panel')
            .select('nombre')
            .eq('panel_id', panel.id)
            .eq('numero_usuario', zoneOrUser)
            .maybeSingle();
          if (userData?.nombre) {
            nombreElemento = `${userData.nombre} (Usuario ${zoneOrUser})`;
          } else {
            nombreElemento = `Usuario ${zoneOrUser}`;
          }
        } else {
          // Es un evento de sensor/zona (Alarma, Sabotaje, Fallo, etc.)
          const { data: zonaData } = await db
            .from('alarmas_zonas')
            .select('nombre_zona')
            .eq('panel_id', panel.id)
            .eq('numero_zona', zoneOrUser)
            .maybeSingle();
          if (zonaData?.nombre_zona) {
            nombreElemento = `${zonaData.nombre_zona} (Zona ${zoneOrUser})`;
          } else {
            nombreElemento = `Zona ${zoneOrUser}`;
          }
        }
      }

      // 6. Generar descripción estructurada legible
      let descripcionFinal = '';
      if (categoriaCid === 'apertura' || categoriaCid === 'cierre') {
        descripcionFinal = `${cid.descripcion} por ${nombreElemento}`;
      } else if (esRestablecimiento) {
        descripcionFinal = `Restablecimiento de ${cid.descripcion.toLowerCase()} en ${nombreElemento}`;
      } else {
        descripcionFinal = `${cid.descripcion} en ${nombreElemento}`;
      }

      // 7. Determinar prioridad y estado de gestión
      const prioridadFinal = cid.prioridad_defecto || 'media';
      
      // En central de monitoreo, sólo las alarmas críticas o fallos graves quedan "pendientes" de acción.
      // Los armados, desarmados y tests son puramente informativos y se auto-procesan.
      let estadoGestion = 'pendiente';
      if (
        prioridadFinal === 'baja' || 
        prioridadFinal === 'informativa' || 
        ['apertura', 'cierre', 'test'].includes(categoriaCid) ||
        esRestablecimiento
      ) {
        estadoGestion = (categoriaCid === 'test') ? 'test_omitido' : 'atendido';
      }

      // Mapear tipo de evento final aceptado por la base de datos
      let dbTipoEvento = 'evento';
      if (['alarma', 'fallo', 'test', 'entrada', 'salida', 'cmd_usuario'].includes(categoriaCid)) {
        dbTipoEvento = categoriaCid;
      } else if (categoriaCid === 'apertura') {
        dbTipoEvento = 'salida';
      } else if (categoriaCid === 'cierre') {
        dbTipoEvento = 'entrada';
      }

      // 8. Registrar en la tabla profesional alarmas_eventos_historico
      const { data: alarmEvent, error: insertErr } = await db
        .from('alarmas_eventos_historico')
        .insert({
          panel_id: panel ? panel.id : null,
          cuenta: account,
          codigo_evento_cid: eventCode,
          calificador: qualifier,
          particion: partition,
          zona_o_usuario: zoneOrUser,
          tipo_evento: dbTipoEvento,
          descripcion_evento: descripcionFinal,
          timestamp_evento: new Date().toISOString(),
          trama_original: tramaRaw,
          prioridad: prioridadFinal,
          estado_gestion: estadoGestion,
        })
        .select('*')
        .maybeSingle();

      if (insertErr) {
        this.logger.error(`❌ [Receptora Alarma] Error al persistir en alarmas_eventos_historico: ${insertErr.message}`);
      } else {
        this.logger.log(`💾 [Receptora Alarma] Guardado en historial de alarmas (ID: ${alarmEvent?.id || '?'})`);
      }

      // 9. Emitir a través del poller general (para no romper web sockets ni vistas tradicionales de control de acceso)
      if (deviceId) {
        const eventoCompat: EventoAcceso = {
          dispositivo_id: deviceId,
          nombre_dispositivo: deviceName,
          tipo_evento: dbTipoEvento === 'alarma' ? 'alarma' : (esRestablecimiento ? 'evento' : dbTipoEvento),
          metodo_acceso: 'remoto',
          nombre_persona: descripcionFinal,
          documento_persona: esRestablecimiento ? 'RESTABLECIMIENTO' : (dbTipoEvento === 'alarma' ? 'ALARMA' : 'EVENTO'),
          codigo_tarjeta: eventCode,
          face_id_ref: `ZONA_${zoneOrUser}`,
          timestamp: new Date().toISOString(),
          detalles_raw: {
            cuenta: account,
            evento: eventCode,
            particion: partition,
            zona_usuario: zoneOrUser,
            calificador: qualifier,
            trama_original: tramaRaw,
            alarma_evento_id: alarmEvent?.id || null
          },
        };
        this.devicePoller.saveAndEmit(eventoCompat);
      }

    } catch (err) {
      this.logger.error(`❌ [Receptora Alarma] Error al procesar trama: ${err.message}`);
    }
  }
}
