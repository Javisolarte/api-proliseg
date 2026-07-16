import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as net from 'net';
import { SupabaseService } from '../supabase/supabase.service';
import { DevicePollerService, EventoAcceso } from '../control-acceso/device-poller.service';

@Injectable()
export class AlarmasReceptorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AlarmasReceptorService.name);
  private server: net.Server | null = null;
  private readonly port = parseInt(process.env.ALARM_RECEIVER_PORT || '10300', 10);

  // Mapa para guardar las conexiones físicas asociadas a cada cuenta de monitoreo
  private activeIntelbrasSockets = new Map<string, net.Socket>();

  constructor(
    private readonly supabase: SupabaseService,
    private readonly devicePoller: DevicePollerService,
  ) {}

  public getIntelbrasSocket(account: string): net.Socket | null {
    const socket = this.activeIntelbrasSockets.get(account);
    if (!socket) return null;
    if (socket.destroyed || !socket.writable) {
      this.activeIntelbrasSockets.delete(account);
      return null;
    }
    return socket;
  }

  // Mapa extra para sockets "anónimos" (que solo envían keep-alive pero aún no han enviado evento)
  private anonymousSockets = new Set<net.Socket>();

  public registerIntelbrasSocket(account: string, socket: net.Socket) {
    if (!account) return;
    this.activeIntelbrasSockets.set(account, socket);
    this.anonymousSockets.delete(socket); // Lo removemos de anónimos porque ya tiene identidad
    this.logger.log(`🔗 [Receptora Alarma] Socket enlazado exitosamente a la cuenta: ${account}`);
  }

  public isAccountConnected(account: string): boolean {
    return this.getIntelbrasSocket(account) !== null;
  }

  public getStatus() {
    const connectedAccounts = Array.from(this.activeIntelbrasSockets.keys())
      .filter((account) => this.isAccountConnected(account));

    return {
      port: this.port,
      listening: this.server?.listening ?? false,
      connectedAccounts,
    };
  }

  private unregisterSocket(socket: net.Socket) {
    this.anonymousSockets.delete(socket);
    for (const [account, activeSocket] of this.activeIntelbrasSockets.entries()) {
      if (activeSocket === socket) {
        this.activeIntelbrasSockets.delete(account);
        this.logger.log(`Socket desvinculado de la cuenta: ${account}`);
      }
    }
  }

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
        const hexString = data.toString('hex').toLowerCase();
        
        // 1. Manejo nativo de Intelbras (Protocolo Binario IsecNet)
        if (hexString === 'f7') {
           this.anonymousSockets.add(socket);
           socket.write(Buffer.from([0xfe])); // ACK de Intelbras
           // No loguear cada latido f7 para no spamear la consola
           return;
        }

        if (hexString.startsWith('0794')) {
           this.anonymousSockets.add(socket);
           this.logger.log(`📥 [Receptora Alarma] [Intelbras] Keep-Alive con MAC recibido: ${hexString}`);
           socket.write(Buffer.from([0xfe])); // ACK
           return;
        }

        if (hexString.startsWith('07b0') || hexString.startsWith('07b1')) {
           // Si es algún evento binario propio de Intelbras, lo reconocemos para que deje de molestar,
           // pero como no lo sabemos decodificar, no enviamos falsas alarmas.
           this.anonymousSockets.add(socket);
           this.logger.log(`📥 [Receptora Alarma] [Intelbras] EVENTO BINARIO RECIBIDO (HEX): ${hexString}`);
           socket.write(Buffer.from([0xfe])); // ACK
           return; // <- MUY IMPORTANTE RETORNAR PARA NO CAER EN CONTACT ID
        }

        // Trama binaria sin cuenta. No se puede asociar de forma segura a un panel.
        if (hexString === '01807e') {
           this.anonymousSockets.add(socket);
           this.logger.warn(`[Receptora Alarma] Trama binaria sin cuenta recibida: ${hexString}. No se enruta para evitar asociarla al panel equivocado.`);
           socket.write(Buffer.from([0xfe])); // ACK
           return;
        }

        // Si no es un formato binario conocido, intentar texto puro (Contact ID)
        const rawString = data.toString('utf-8');
        this.logger.log(`📥 [Receptora Alarma] Paquete recibido (Texto): ${rawString}`);
        this.logger.log(`📥 [Receptora Alarma] Paquete recibido (HEX): ${hexString}`);

        // Responder con ACK (Hex 06) para Contact ID puro
        socket.write(Buffer.from([0x06]));
        this.logger.log(`📤 [Receptora Alarma] ACK (06) enviado.`);

        // 2. Procesar las tramas en el paquete (en caso de que vengan encoladas en corchetes)
        const tramas = rawString.match(/\[([^\]]+)\]/g);
        if (!tramas) {
          this.logger.warn(`⚠️ [Receptora Alarma] Trama con formato inválido o vacía.`);
          return;
        }

        for (const trama of tramas) {
          await this.procesarTrama(trama, socket);
        }
      });

      socket.on('end', () => {
        this.logger.log(`🔌 [Receptora Alarma] Conexión cerrada por el comunicador.`);
      });

      socket.on('close', () => this.unregisterSocket(socket));

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

  private async procesarTrama(tramaRaw: string, socket?: net.Socket) {
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
        const payloadPart = parts[1]?.trim() || '';

        // Extraer la cuenta después del '#'
        const hashIdx = headerPart.indexOf('#');
        account = headerPart.substring(hashIdx + 1).trim();

        // Parsear el payload (ej: 18113001004)
        if (payloadPart.startsWith('18') && payloadPart.length >= 11) {
          qualifier = payloadPart.charAt(2);       // '1' o '3'
          eventCode = payloadPart.substring(3, 6);  // '130'
          partition = payloadPart.substring(6, 8);  // '01'
          zoneOrUser = payloadPart.substring(8, 11); // '004'
        } else {
          eventCode = payloadPart;
        }
      } else {
        // Formato compacto sin pipe: e.g. 884418113001004
        const accountAtEnd = trama.match(/^(.*)#([0-9A-F]{1,20})$/i);
        const contactIdPayload = accountAtEnd ? accountAtEnd[1].trim() : trama;
        if (accountAtEnd) account = accountAtEnd[2].toUpperCase();

        const idx18 = contactIdPayload.indexOf('18');
        if (idx18 !== -1 && contactIdPayload.length >= idx18 + 11) {
          if (!account) account = contactIdPayload.substring(0, idx18).trim().toUpperCase();
          qualifier = contactIdPayload.charAt(idx18 + 2);
          eventCode = contactIdPayload.substring(idx18 + 3, idx18 + 6).toUpperCase();
          partition = contactIdPayload.substring(idx18 + 6, idx18 + 8).toUpperCase();
          zoneOrUser = contactIdPayload.substring(idx18 + 8, idx18 + 11).toUpperCase();
        } else {
          account = '';
          eventCode = trama;
        }
      }

      if (!account || !/^[0-9A-F]{1,20}$/i.test(account) || !/^[0-9A-F]{3,4}$/i.test(eventCode) || !['1', '3'].includes(qualifier)) {
        this.logger.warn(`[Receptora Alarma] Trama Contact ID no enrutable; se descarta para evitar eventos sin cuenta: ${tramaRaw}`);
        return;
      }

      if (socket) {
         // Si la trama trajo una cuenta válida, registramos/actualizamos el mapa de sockets
         this.registerIntelbrasSocket(account, socket);
      }

      this.logger.log(`🔔 [Receptora Alarma] Evento decodificado → Cuenta: ${account}, Evento: ${eventCode}, Zona/Usuario: ${zoneOrUser}, Tipo: ${qualifier}`);

      // 3. Buscar el panel de alarma registrado en Supabase
      const db = this.supabase.getSupabaseAdminClient();
      let { data: panel, error: panelErr } = await db
        .from('alarmas_paneles')
        .select('*')
        .eq('cuenta_monitoreo', account)
        .maybeSingle();

      if (panelErr) throw panelErr;

      // Si no existe el panel registrado en alarmas_paneles, lo auto-registramos directamente
      if (!panel && process.env.ALARM_AUTO_REGISTER_PANELS !== 'true') {
        this.logger.warn(`[Receptora Alarma] Señal recibida de cuenta no registrada (${account}); no se crea ni notifica hasta que la cuenta sea dada de alta.`);
        return;
      }

      if (!panel) {
        const { data: newPanel, error: createErr } = await db
          .from('alarmas_paneles')
          .insert({
            cuenta_monitoreo: account,
            nombre_lugar: `Panel Autoregistrado ${account}`,
            estado_panel: 'en_pruebas',
          })
          .select('*')
          .maybeSingle();

        if (!createErr && newPanel) {
          panel = newPanel;
          this.logger.log(`🆕 [Receptora Alarma] Panel auto-registrado para la cuenta ${account}`);
        } else if (createErr) {
          throw createErr;
        }
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
        '120': { descripcion: 'Pánico', categoria_defecto: 'alarma', prioridad_defecto: 'critica' },
        '122': { descripcion: 'Pánico Silencioso', categoria_defecto: 'alarma', prioridad_defecto: 'critica' },
        '110': { descripcion: 'Alarma de Fuego', categoria_defecto: 'alarma', prioridad_defecto: 'critica' },
        '100': { descripcion: 'Alarma Médica', categoria_defecto: 'alarma', prioridad_defecto: 'critica' },
        '401': { descripcion: 'Desarmado del Sistema', categoria_defecto: 'apertura', prioridad_defecto: 'informativa' },
        '400': { descripcion: 'Armado del Sistema', categoria_defecto: 'cierre', prioridad_defecto: 'informativa' },
        '602': { descripcion: 'Test Periódico de Comunicación', categoria_defecto: 'test', prioridad_defecto: 'baja' },
        '301': { descripcion: 'Fallo de Energía AC', categoria_defecto: 'fallo', prioridad_defecto: 'media' },
        '302': { descripcion: 'Batería Baja del Panel', categoria_defecto: 'fallo', prioridad_defecto: 'alta' },
      };

      let cid = cidInfo || defaultMapping[eventCode];
      
      // Si no existe, usamos una regla general basada en el primer dígito (Contact ID Standard)
      if (!cid) {
        if (eventCode.startsWith('1')) {
           cid = { descripcion: `Alarma Desconocida (${eventCode})`, categoria_defecto: 'alarma', prioridad_defecto: 'critica' };
        } else if (eventCode.startsWith('3')) {
           cid = { descripcion: `Fallo del Sistema (${eventCode})`, categoria_defecto: 'fallo', prioridad_defecto: 'media' };
        } else if (eventCode.startsWith('4')) {
           cid = { descripcion: `Apertura/Cierre (${eventCode})`, categoria_defecto: 'evento', prioridad_defecto: 'informativa' };
        } else {
           cid = { descripcion: `Evento Contact ID ${eventCode}`, categoria_defecto: 'evento', prioridad_defecto: 'media' };
        }

        // AUTO-REGISTRAR EL CÓDIGO EN EL CATÁLOGO PARA EVITAR ERROR DE FOREIGN KEY
        const { error: catalogError } = await db.from('alarmas_contact_id_catalogo').upsert({
           codigo: eventCode,
           descripcion: cid.descripcion,
           categoria_defecto: cid.categoria_defecto,
           prioridad_defecto: cid.prioridad_defecto
        });
        if (catalogError) throw catalogError;
      } else if (!cidInfo && cid) {
        // Estaba en defaultMapping pero no en BD, también lo insertamos
        const { error: catalogError } = await db.from('alarmas_contact_id_catalogo').upsert({
           codigo: eventCode,
           descripcion: cid.descripcion,
           categoria_defecto: cid.categoria_defecto,
           prioridad_defecto: cid.prioridad_defecto
        });
        if (catalogError) throw catalogError;
      }

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

      // Algunos comunicadores retransmiten una alarma hasta recibir el ciclo de
      // restauración. Mantener una sola alerta activa evita saturar la cola y
      // repetir la sirena del operador, sin perder el evento inicial.
      if (panel && estadoGestion === 'pendiente') {
        const { data: activeDuplicate, error: duplicateErr } = await db
          .from('alarmas_eventos_historico')
          .select('id')
          .eq('panel_id', panel.id)
          .eq('codigo_evento_cid', eventCode)
          .eq('calificador', qualifier)
          .eq('zona_o_usuario', zoneOrUser)
          .in('estado_gestion', ['pendiente', 'en_proceso'])
          .limit(1)
          .maybeSingle();

        if (duplicateErr) throw duplicateErr;
        if (activeDuplicate) {
          this.logger.warn(`[Receptora Alarma] Señal duplicada ignorada para cuenta ${account}, evento ${eventCode}, zona ${zoneOrUser}.`);
          return;
        }
      }

      // Auto-clear existing pending alarms on restoration or disarm
      if (panel) {
        if (esRestablecimiento) {
          // Auto-close any pending alarm for this zone on this panel
          const { error: autoCloseErr } = await db
            .from('alarmas_eventos_historico')
            .update({
              estado_gestion: 'atendido',
              comentarios_operador: `Restablecimiento recibido en zona ${zoneOrUser}. Cerrado automáticamente.`,
              fecha_fin_gestion: new Date().toISOString(),
            })
            .eq('panel_id', panel.id)
            .eq('zona_o_usuario', zoneOrUser)
            .eq('tipo_evento', 'alarma')
            .in('estado_gestion', ['pendiente', 'en_proceso']);
          
          if (autoCloseErr) {
            this.logger.error(`❌ [Receptora Alarma] Error al auto-cerrar alarma por restablecimiento: ${autoCloseErr.message}`);
          } else {
            this.logger.log(`✅ [Receptora Alarma] Alarmas pendientes auto-cerradas para panel ${account} zona ${zoneOrUser}`);
          }
        } else if (eventCode === '401') {
          // Auto-close ALL pending alarms on this panel because the system has been disarmed
          const { error: autoCloseErr } = await db
            .from('alarmas_eventos_historico')
            .update({
              estado_gestion: 'atendido',
              comentarios_operador: `Desarmado recibido del sistema. Cerrado automáticamente.`,
              fecha_fin_gestion: new Date().toISOString(),
            })
            .eq('panel_id', panel.id)
            .eq('tipo_evento', 'alarma')
            .in('estado_gestion', ['pendiente', 'en_proceso']);
          
          if (autoCloseErr) {
            this.logger.error(`❌ [Receptora Alarma] Error al auto-cerrar alarmas por desarmado: ${autoCloseErr.message}`);
          } else {
            this.logger.log(`✅ [Receptora Alarma] Todas las alarmas pendientes auto-cerradas por desarmado del panel ${account}`);
          }
        }
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

      // 9. Emitir SIEMPRE por WebSocket (con o sin dispositivo_id vinculado)
      // El dispositivo_id se emite usando el panel.id o la cuenta para activar el modal en frontend.
      const eventoCompat: EventoAcceso = {
        dispositivo_id: panel?.id || `alarma-panel-${account}`,
        nombre_dispositivo: panel?.nombre_lugar || `Panel Alarma ${account}`,
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
          panel_id: panel?.id || null,
          alarma_evento_id: alarmEvent?.id || null,
          evento_id: alarmEvent?.id || null,
          prioridad: prioridadFinal,
          zona_nombre: nombreElemento,
        },
      };
      this.devicePoller.emitRawEvent(eventoCompat);

    } catch (err) {
      this.logger.error(`❌ [Receptora Alarma] Error al procesar trama: ${err.message}`);
    }
  }
}
