import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AlarmStrategyFactory } from './strategies/alarm-strategy.factory';
import { AlarmasGatewayService } from './alarmas-gateway.service';
import { DevicePollerService } from '../control-acceso/device-poller.service';

@Injectable()
export class AlarmasService {
  private readonly logger = new Logger(AlarmasService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly strategyFactory: AlarmStrategyFactory,
    private readonly gatewayService: AlarmasGatewayService,
    private readonly devicePoller: DevicePollerService,
  ) {}

  // ─── PANELES DE ALARMA (CUENTAS) ──────────────────────────────────────────

  async findAllPaneles() {
    const { data, error } = await this.supabase
      .getClient()
      .from('alarmas_paneles')
      .select('*, cliente:clientes(id, nombre_empresa, nit)');
    if (error) throw error;
    return data;
  }

  async findOnePanel(id: string) {
    const db = this.supabase.getClient();
    
    // Panel básico
    const { data: panel, error: panelErr } = await db
      .from('alarmas_paneles')
      .select('*, cliente:clientes(*)')
      .eq('id', id)
      .maybeSingle();

    if (panelErr) throw panelErr;
    if (!panel) throw new NotFoundException(`Panel con ID ${id} no encontrado`);

    const conectado = this.gatewayService.isPanelConnected(panel.cuenta_monitoreo);

    // Zonas
    const { data: zonas, error: zonasErr } = await db
      .from('alarmas_zonas')
      .select('*')
      .eq('panel_id', id)
      .order('numero_zona', { ascending: true });

    if (zonasErr) throw zonasErr;

    // Particiones
    const { data: particiones, error: partErr } = await db
      .from('alarmas_particiones')
      .select('*')
      .eq('panel_id', id)
      .order('numero_particion', { ascending: true });

    if (partErr) throw partErr;

    // Usuarios del panel
    const { data: usuarios, error: userErr } = await db
      .from('alarmas_usuarios_panel')
      .select('*')
      .eq('panel_id', id)
      .order('numero_usuario', { ascending: true });

    if (userErr) throw userErr;

    // Contactos de emergencia
    const { data: contactos, error: contactsErr } = await db
      .from('alarmas_contactos_emergencia')
      .select('*')
      .eq('panel_id', id)
      .order('orden_llamada', { ascending: true });

    if (contactsErr) throw contactsErr;

    return {
      ...panel,
      conectado: conectado || false,
      zonas: zonas || [],
      particiones: particiones || [],
      usuariosPanel: usuarios || [],
      contactosEmergencia: contactos || [],
    };
  }

  async createPanel(body: any) {
    const {
      monitoreo_activo,
      sirena_habilitada,
      modo_silencioso,
      notificacion_sms,
      notificacion_llamada,
      prioridad,
      ...cleanedBody
    } = body;

    const { data, error } = await this.supabase
      .getClient()
      .from('alarmas_paneles')
      .insert(cleanedBody)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async updatePanel(id: string, body: any) {
    const {
      monitoreo_activo,
      sirena_habilitada,
      modo_silencioso,
      notificacion_sms,
      notificacion_llamada,
      prioridad,
      ...cleanedBody
    } = body;

    // Convert empty strings to null for relations
    if (cleanedBody.cliente_id === '') cleanedBody.cliente_id = null;

    const { data, error } = await this.supabase
      .getClient()
      .from('alarmas_paneles')
      .update(cleanedBody)
      .eq('id', id)
      .select('*')
      .maybeSingle();
      
    if (error) {
      this.logger.error(`Error updating panel ${id}:`, error);
      throw new Error(`DB Error: ${error.message} (Code: ${error.code})`);
    }
    return data;
  }

  async deletePanel(id: string) {
    const { error } = await this.supabase
      .getClient()
      .from('alarmas_paneles')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return { ok: true };
  }

  // ─── ZONAS DEL PANEL ──────────────────────────────────────────────────────

  async findZonesByPanel(panelId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('alarmas_zonas')
      .select('*, particion:alarmas_particiones(id, nombre_particion, numero_particion)')
      .eq('panel_id', panelId)
      .order('numero_zona', { ascending: true });
    if (error) throw error;
    return data;
  }

  async createZone(body: any) {
    const { data, error } = await this.supabase
      .getClient()
      .from('alarmas_zonas')
      .insert(body)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async updateZone(id: string, body: any) {
    const { data, error } = await this.supabase
      .getClient()
      .from('alarmas_zonas')
      .update(body)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async deleteZone(id: string) {
    const { error } = await this.supabase
      .getClient()
      .from('alarmas_zonas')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return { ok: true };
  }

  // ─── PARTICIONES DEL PANEL ───────────────────────────────────────────────

  async findPartitionsByPanel(panelId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('alarmas_particiones')
      .select('*')
      .eq('panel_id', panelId)
      .order('numero_particion', { ascending: true });
    if (error) throw error;
    return data;
  }

  async createPartition(body: any) {
    const { data, error } = await this.supabase
      .getClient()
      .from('alarmas_particiones')
      .insert(body)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async updatePartition(id: string, body: any) {
    const { data, error } = await this.supabase
      .getClient()
      .from('alarmas_particiones')
      .update(body)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async deletePartition(id: string) {
    const { error } = await this.supabase
      .getClient()
      .from('alarmas_particiones')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return { ok: true };
  }

  // ─── USUARIOS DEL PANEL ───────────────────────────────────────────────────

  async findUsersByPanel(panelId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('alarmas_usuarios_panel')
      .select('*')
      .eq('panel_id', panelId)
      .order('numero_usuario', { ascending: true });
    if (error) throw error;
    return data;
  }

  async createUser(body: any) {
    const { data, error } = await this.supabase
      .getClient()
      .from('alarmas_usuarios_panel')
      .insert(body)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async updateUser(id: string, body: any) {
    const { data, error } = await this.supabase
      .getClient()
      .from('alarmas_usuarios_panel')
      .update(body)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async deleteUser(id: string) {
    const { error } = await this.supabase
      .getClient()
      .from('alarmas_usuarios_panel')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return { ok: true };
  }

  // ─── CONTACTOS DE EMERGENCIA ──────────────────────────────────────────────

  async findContactsByPanel(panelId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('alarmas_contactos_emergencia')
      .select('*')
      .eq('panel_id', panelId)
      .order('orden_llamada', { ascending: true });
    if (error) throw error;
    return data;
  }

  async createContact(body: any) {
    const { data, error } = await this.supabase
      .getClient()
      .from('alarmas_contactos_emergencia')
      .insert(body)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async updateContact(id: string, body: any) {
    const { data, error } = await this.supabase
      .getClient()
      .from('alarmas_contactos_emergencia')
      .update(body)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async deleteContact(id: string) {
    const { error } = await this.supabase
      .getClient()
      .from('alarmas_contactos_emergencia')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return { ok: true };
  }

  // ─── COLA DE MONITOREO EN VIVO Y HISTORIAL DE EVENTOS ──────────────────────

  async getColaMonitoreo() {
    const { data, error } = await this.supabase
      .getClient()
      .from('v_alarmas_cola_monitoreo')
      .select('*');
    if (error) throw error;
    return data;
  }

  async getHistorial(query: { limit?: number; offset?: number; panel_id?: string; tipo_evento?: string; estado_gestion?: string }) {
    const limit = query.limit || 50;
    const offset = query.offset || 0;
    
    let dbQuery = this.supabase
      .getClient()
      .from('alarmas_eventos_historico')
      .select('*, alarmas_paneles(nombre_lugar, cuenta_monitoreo)', { count: 'exact' })
      .order('timestamp_evento', { ascending: false });

    if (query.panel_id) {
      dbQuery = dbQuery.eq('panel_id', query.panel_id);
    }
    if (query.tipo_evento) {
      dbQuery = dbQuery.eq('tipo_evento', query.tipo_evento);
    }
    if (query.estado_gestion) {
      dbQuery = dbQuery.eq('estado_gestion', query.estado_gestion);
    }

    const { data, count, error } = await dbQuery
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // Mapear para coincidir con la vista que el frontend espera (creado_en, nombre_lugar)
    const mappedData = data.map((item: any) => ({
      ...item,
      creado_en: item.timestamp_evento || item.created_at,
      nombre_lugar: item.alarmas_paneles?.nombre_lugar || 'Desconocido',
      cuenta_monitoreo: item.alarmas_paneles?.cuenta_monitoreo || item.cuenta,
    }));

    return { data: mappedData, total: count };
  }

  // ─── CONTROL DE GESTIÓN (OPERADOR CENTRAL DE MONITOREO) ──────────────────────

  async atenderAlarma(eventoId: string, operadorId: number) {
    const db = this.supabase.getClient();
    
    // 1. Validar que la alarma exista y esté pendiente
    const { data: event, error: fetchErr } = await db
      .from('alarmas_eventos_historico')
      .select('*')
      .eq('id', eventoId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!event) throw new NotFoundException(`Alarma con ID ${eventoId} no encontrada`);

    // 2. Cambiar estado a 'en_proceso'
    const { data: updatedEvent, error: updateErr } = await db
      .from('alarmas_eventos_historico')
      .update({
        estado_gestion: 'en_proceso',
        operador_id: operadorId,
        fecha_inicio_gestion: new Date().toISOString(),
      })
      .eq('id', eventoId)
      .select('*')
      .maybeSingle();

    if (updateErr) throw updateErr;

    // 3. Registrar bitácora de inicio de gestión
    const { error: logErr } = await db
      .from('alarmas_gestion_bitacora')
      .insert({
        evento_alarma_id: eventoId,
        paso_realizado: 'Inicio de Gestión',
        detalle_resultado: 'El operador ha tomado la alarma para iniciar el protocolo de verificación.',
        operador_id: operadorId,
      });

    if (logErr) {
      this.logger.warn(`⚠️ [Monitoreo] Error al registrar bitácora de inicio: ${logErr.message}`);
    }

    // 4. Emitir evento vía WebSocket
    if (event.panel_id) {
      try {
        const { data: pData } = await db
          .from('alarmas_paneles')
          .select('cuenta_monitoreo, nombre_lugar')
          .eq('id', event.panel_id)
          .maybeSingle();

        const cuenta = pData?.cuenta_monitoreo || event.cuenta || '0000';
        const nombreLugar = pData?.nombre_lugar || `Panel ${cuenta}`;

        this.devicePoller.saveAndEmit({
          dispositivo_id: event.panel_id,
          nombre_dispositivo: nombreLugar,
          tipo_evento: 'panel_status',
          metodo_acceso: 'remoto',
          nombre_persona: 'Alarma en Atención',
          documento_persona: 'GESTION',
          codigo_tarjeta: 'ATENCION',
          timestamp: new Date().toISOString(),
          detalles_raw: {
            cuenta,
            panel_id: event.panel_id,
            evento_id: eventoId,
            estado_gestion: 'en_proceso'
          }
        });
      } catch (err: any) {
        this.logger.error(`Error al emitir WebSocket de atención: ${err.message}`);
      }
    }

    return updatedEvent;
  }

  async cerrarAlarma(eventoId: string, payload: { estado_gestion: string; comentarios_operador: string; operador_id: number }) {
    const db = this.supabase.getClient();

    // 1. Validar que el evento exista
    const { data: event, error: fetchErr } = await db
      .from('alarmas_eventos_historico')
      .select('*')
      .eq('id', eventoId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!event) throw new NotFoundException(`Alarma con ID ${eventoId} no encontrada`);

    // 2. Cerrar evento en base de datos
    const { data: updatedEvent, error: updateErr } = await db
      .from('alarmas_eventos_historico')
      .update({
        estado_gestion: payload.estado_gestion,
        comentarios_operador: payload.comentarios_operador,
        fecha_fin_gestion: new Date().toISOString(),
        operador_id: payload.operador_id,
      })
      .eq('id', eventoId)
      .select('*')
      .maybeSingle();

    if (updateErr) throw updateErr;

    // 3. Registrar bitácora de cierre
    const { error: logErr } = await db
      .from('alarmas_gestion_bitacora')
      .insert({
        evento_alarma_id: eventoId,
        paso_realizado: `Cierre del Evento - ${payload.estado_gestion.toUpperCase()}`,
        detalle_resultado: `Se finaliza la gestión con resolución: ${payload.estado_gestion}. Comentarios: ${payload.comentarios_operador}`,
        operador_id: payload.operador_id,
      });

    if (logErr) {
      this.logger.warn(`⚠️ [Monitoreo] Error al registrar bitácora de cierre: ${logErr.message}`);
    }

    // 4. Emitir evento vía WebSocket
    if (event.panel_id) {
      try {
        const { data: pData } = await db
          .from('alarmas_paneles')
          .select('cuenta_monitoreo, nombre_lugar')
          .eq('id', event.panel_id)
          .maybeSingle();

        const cuenta = pData?.cuenta_monitoreo || event.cuenta || '0000';
        const nombreLugar = pData?.nombre_lugar || `Panel ${cuenta}`;

        this.devicePoller.saveAndEmit({
          dispositivo_id: event.panel_id,
          nombre_dispositivo: nombreLugar,
          tipo_evento: 'panel_status',
          metodo_acceso: 'remoto',
          nombre_persona: 'Alarma Cerrada',
          documento_persona: 'GESTION',
          codigo_tarjeta: 'CERRADA',
          timestamp: new Date().toISOString(),
          detalles_raw: {
            cuenta,
            panel_id: event.panel_id,
            evento_id: eventoId,
            estado_gestion: payload.estado_gestion
          }
        });
      } catch (err: any) {
        this.logger.error(`Error al emitir WebSocket de cierre: ${err.message}`);
      }
    }

    return updatedEvent;
  }

  async getBitacora(eventoId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('alarmas_gestion_bitacora')
      .select('*, operador:usuarios_externos(id, nombre_completo, rol)')
      .eq('evento_alarma_id', eventoId)
      .order('timestamp_accion', { ascending: true });
    if (error) throw error;
    return data;
  }

  async registrarBitacoraPaso(eventoId: string, payload: { paso_realizado: string; detalle_resultado: string; operador_id: number }) {
    const { data, error } = await this.supabase
      .getClient()
      .from('alarmas_gestion_bitacora')
      .insert({
        evento_alarma_id: eventoId,
        paso_realizado: payload.paso_realizado,
        detalle_resultado: payload.detalle_resultado,
        operador_id: payload.operador_id,
      })
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  // ─── COMANDOS BIDIRECCIONALES (ARMADO / DESARMADO / SIRENA) ───────────────

  async armarPanel(id: string, payload: { particion: number; pin: string }) {
    const panel = await this.findOnePanel(id);
    const strategy = this.strategyFactory.getStrategy(panel.marca_modelo);
    const result = await strategy.arm(panel, payload.particion, payload.pin);

    if (result.success) {
      // Registrar evento de armado remoto en el histórico
      await this.supabase
        .getClient()
        .from('alarmas_eventos_historico')
        .insert({
          panel_id: panel.id,
          cuenta: panel.cuenta_monitoreo,
          codigo_evento_cid: '400', // C01. 400 = Armado del sistema
          calificador: '1', // 1 = Nuevo evento
          particion: payload.particion.toString().padStart(2, '0'),
          zona_o_usuario: '000', // Canal virtual / Remoto
          tipo_evento: 'cmd_usuario',
          descripcion_evento: `Armado remoto (Partición ${payload.particion}) vía Web`,
          timestamp_evento: new Date().toISOString(),
          trama_original: `[CMD#${panel.cuenta_monitoreo}|ARM_PART_${payload.particion}]`,
          prioridad: 'informativa',
          estado_gestion: 'atendido',
        });
        
      // 🔥 Emitir al frontend para que el Live Feed se actualice al instante
      this.devicePoller.emitRawEvent({
        dispositivo_id: panel.id,
        nombre_dispositivo: panel.nombre_lugar,
        tipo_evento: 'cmd_usuario',
        timestamp: new Date().toISOString(),
        detalles_raw: { cuenta: panel.cuenta_monitoreo, panel_id: panel.id }
      });
    }

    return result;
  }

  async desarmarPanel(id: string, payload: { particion: number; pin: string }) {
    const panel = await this.findOnePanel(id);
    const strategy = this.strategyFactory.getStrategy(panel.marca_modelo);
    const result = await strategy.disarm(panel, payload.particion, payload.pin);

    if (result.success) {
      // Registrar evento de desarmado remoto en el histórico
      await this.supabase
        .getClient()
        .from('alarmas_eventos_historico')
        .insert({
          panel_id: panel.id,
          cuenta: panel.cuenta_monitoreo,
          codigo_evento_cid: '401', // C01. 401 = Desarmado del sistema
          calificador: '1',
          particion: payload.particion.toString().padStart(2, '0'),
          zona_o_usuario: '000',
          tipo_evento: 'cmd_usuario',
          descripcion_evento: `Desarmado remoto (Partición ${payload.particion}) vía Web`,
          timestamp_evento: new Date().toISOString(),
          trama_original: `[CMD#${panel.cuenta_monitoreo}|DISARM_PART_${payload.particion}]`,
          prioridad: 'informativa',
          estado_gestion: 'atendido',
        });
        
      // 🔥 Emitir al frontend para que el Live Feed se actualice al instante
      this.devicePoller.emitRawEvent({
        dispositivo_id: panel.id,
        nombre_dispositivo: panel.nombre_lugar,
        tipo_evento: 'cmd_usuario',
        timestamp: new Date().toISOString(),
        detalles_raw: { cuenta: panel.cuenta_monitoreo, panel_id: panel.id }
      });
    }

    return result;
  }

  async controlarSirena(id: string, payload: { accion: 'encender' | 'apagar' }) {
    const panel = await this.findOnePanel(id);
    const strategy = this.strategyFactory.getStrategy(panel.marca_modelo);
    const state = payload.accion === 'encender' ? 'on' : 'off';
    const result = await strategy.toggleSiren(panel, state);

    if (result.success) {
      // Registrar evento en el histórico
      await this.supabase
        .getClient()
        .from('alarmas_eventos_historico')
        .insert({
          panel_id: panel.id,
          cuenta: panel.cuenta_monitoreo,
          codigo_evento_cid: payload.accion === 'encender' ? '320' : '321', // 320 = Sirena, 321 = Restablecimiento de Sirena
          calificador: payload.accion === 'encender' ? '1' : '3',
          particion: '01',
          zona_o_usuario: '000',
          tipo_evento: 'cmd_usuario',
          descripcion_evento: `Sirena remota ${payload.accion === 'encender' ? 'ACTIVADA' : 'DESACTIVADA'} vía Web`,
          timestamp_evento: new Date().toISOString(),
          trama_original: `[CMD#${panel.cuenta_monitoreo}|SIREN_${payload.accion.toUpperCase()}]`,
          prioridad: payload.accion === 'encender' ? 'alta' : 'informativa',
          estado_gestion: 'atendido',
        });

      // 🔥 Emitir al frontend para que el Live Feed se actualice al instante
      this.devicePoller.emitRawEvent({
        dispositivo_id: panel.id,
        nombre_dispositivo: panel.nombre_lugar,
        tipo_evento: 'cmd_usuario',
        timestamp: new Date().toISOString(),
        detalles_raw: { cuenta: panel.cuenta_monitoreo, panel_id: panel.id }
      });
    }

    return result;
  }

  async sincronizarUsuarioPanel(panelId: string, payload: { numero_usuario: number; nombre: string; pin_codigo: string }) {
    const panel = await this.findOnePanel(panelId);
    const strategy = this.strategyFactory.getStrategy(panel.marca_modelo);
    return strategy.syncUser(panel, payload.numero_usuario, payload.nombre, payload.pin_codigo);
  }

  async eliminarUsuarioPanel(panelId: string, userNumber: number) {
    const panel = await this.findOnePanel(panelId);
    const strategy = this.strategyFactory.getStrategy(panel.marca_modelo);
    return strategy.deleteUser(panel, userNumber);
  }
}
