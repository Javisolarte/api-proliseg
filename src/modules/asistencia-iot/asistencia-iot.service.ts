import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { DahuaService } from '../control-acceso/dahua.service';
import {
  UpdatePuestoIotConfigDto,
  CreateHorarioDto,
  CreateEnlaceDto,
  RegistroPublicoPersonalDto,
  CreatePersonalManualDto,
  ProcesarMarcacionManualDto,
} from './dto/asistencia-iot.dto';
import * as crypto from 'crypto';

@Injectable()
export class AsistenciaIotService {
  private readonly logger = new Logger(AsistenciaIotService.name);
  private _vpsStorage: any = null;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly dahuaService: DahuaService,
  ) {}

  private get adminClient() {
    return this.supabase.getSupabaseAdminClient();
  }

  /**
   * Conexión directa al Supabase Storage nativo de la VPS (evita almacenamiento local)
   */
  private get vpsStorage() {
    if (!this._vpsStorage) {
      const url = process.env.SUPABASE_URL || 'https://ttkubmwrwgqxjdafpgji.supabase.co';
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';
      const client = createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      this._vpsStorage = client.storage;
    }
    return this._vpsStorage;
  }

  /**
   * Resuelve el puesto ya sea que el frontend envíe el ID primario de BD (ej: 78)
   * o el código de puesto asignado (ej: 1035 para Corponariño).
   */
  private async resolveRealPuesto(puestoIdOrCode: number): Promise<any> {
    if (!puestoIdOrCode) return null;

    // 1. Intentar por ID primario
    const { data: byId } = await this.adminClient
      .from('puestos_trabajo')
      .select('id, nombre, direccion, ciudad, codigo_puesto')
      .eq('id', puestoIdOrCode)
      .maybeSingle();

    if (byId) return byId;

    // 2. Si no coincide, intentar por codigo_puesto
    const { data: byCode } = await this.adminClient
      .from('puestos_trabajo')
      .select('id, nombre, direccion, ciudad, codigo_puesto')
      .eq('codigo_puesto', String(puestoIdOrCode))
      .maybeSingle();

    return byCode || null;
  }

  private async resolveRealPuestoId(puestoIdOrCode: number): Promise<number> {
    const puesto = await this.resolveRealPuesto(puestoIdOrCode);
    return puesto ? puesto.id : puestoIdOrCode;
  }

  // ==========================================================================
  // 1. PUESTOS & CONFIGURACIÓN IOT
  // ==========================================================================

  async getPuestosList() {
    let query = this.adminClient
      .from('puestos_trabajo')
      .select('id, nombre, direccion, ciudad, codigo_puesto, activo')
      .is('deleted_at', null)
      .order('nombre');

    const { data: puestos, error } = await query;

    if (error) {
      this.logger.error(`Error listando puestos: ${error.message}`);
      throw error;
    }

    // Obtener configuraciones IoT de forma segura
    let configs: any[] = [];
    try {
      const { data } = await this.adminClient
        .from('puestos_asistencia_iot_config')
        .select('*, dispositivo:dispositivos_iot(id, nombre_identificador, ip_direccion, estado)');
      if (data) configs = data;
    } catch {}

    const configMap = new Map((configs || []).map((c: any) => [c.puesto_id, c]));

    // Contar personal por puesto
    const countMap: Record<number, number> = {};
    try {
      const { data: personalCounts } = await this.adminClient
        .from('asistencia_iot_personal')
        .select('puesto_id')
        .eq('activo', true);

      (personalCounts || []).forEach((p: any) => {
        countMap[p.puesto_id] = (countMap[p.puesto_id] || 0) + 1;
      });
    } catch {}

    const hoy = new Date().toISOString().split('T')[0];
    const hoyMap: Record<number, { total: number; a_tiempo: number; tarde: number }> = {};
    try {
      const { data: asistenciasHoy } = await this.adminClient
        .from('asistencia_iot_registros')
        .select('puesto_id, estado_entrada')
        .eq('fecha', hoy);

      (asistenciasHoy || []).forEach((a: any) => {
        if (!hoyMap[a.puesto_id]) {
          hoyMap[a.puesto_id] = { total: 0, a_tiempo: 0, tarde: 0 };
        }
        hoyMap[a.puesto_id].total++;
        if (a.estado_entrada === 'a_tiempo' || a.estado_entrada === 'temprano') {
          hoyMap[a.puesto_id].a_tiempo++;
        } else {
          hoyMap[a.puesto_id].tarde++;
        }
      });
    } catch {}

    return (puestos || []).map((p: any) => {
      const cfg = configMap.get(p.id) || null;
      const metricasHoy = hoyMap[p.id] || { total: 0, a_tiempo: 0, tarde: 0 };
      return {
        id: p.id,
        nombre: p.nombre,
        direccion: p.direccion,
        ciudad: p.ciudad,
        codigo_puesto: p.codigo_puesto,
        iot_activo: cfg?.iot_activo || false,
        dispositivo_iot_id: cfg?.dispositivo_iot_id || null,
        dispositivo: cfg?.dispositivo || null,
        tolerancia_minutos: cfg?.tolerancia_minutos || 10,
        total_personal: countMap[p.id] || 0,
        asistencias_hoy: metricasHoy,
      };
    });
  }

  async getPuestoConfig(puestoId: number) {
    const puesto = await this.resolveRealPuesto(puestoId);
    if (!puesto) throw new NotFoundException('Puesto no encontrado');

    const { data: config } = await this.adminClient
      .from('puestos_asistencia_iot_config')
      .select('*, dispositivo:dispositivos_iot(id, nombre_identificador, ip_direccion, estado)')
      .eq('puesto_id', puesto.id)
      .maybeSingle();

    return {
      puesto,
      config: config || {
        puesto_id: puesto.id,
        iot_activo: false,
        dispositivo_iot_id: null,
        tolerancia_minutos: 10,
      },
    };
  }

  async updatePuestoConfig(puestoId: number, dto: UpdatePuestoIotConfigDto) {
    const realPuestoId = await this.resolveRealPuestoId(puestoId);
    const payload = {
      puesto_id: realPuestoId,
      iot_activo: dto.iot_activo,
      dispositivo_iot_id: dto.dispositivo_iot_id || null,
      tolerancia_minutos: dto.tolerancia_minutos || 10,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.adminClient
      .from('puestos_asistencia_iot_config')
      .upsert(payload, { onConflict: 'puesto_id' })
      .select('*, dispositivo:dispositivos_iot(id, nombre_identificador, ip_direccion, estado)')
      .single();

    if (error) {
      this.logger.error(`Error actualizando config IoT puesto ${realPuestoId}: ${error.message}`);
      throw error;
    }
    return data;
  }

  async getDispositivosIot() {
    const { data, error } = await this.adminClient
      .from('dispositivos_iot')
      .select('id, nombre_identificador, ip_direccion, tipo_dispositivo, estado, puesto_id')
      .order('nombre_identificador');

    if (error) throw error;
    return data || [];
  }

  // ==========================================================================
  // 2. HORARIOS DE ASISTENCIA DEL PUESTO
  // ==========================================================================

  async getHorarios(puestoId: number) {
    const realPuestoId = await this.resolveRealPuestoId(puestoId);
    const { data, error } = await this.adminClient
      .from('puestos_horarios_asistencia')
      .select('*')
      .eq('puesto_id', realPuestoId)
      .eq('activo', true)
      .order('nombre_horario');

    if (error) throw error;
    return data || [];
  }

  async createHorario(puestoId: number, dto: CreateHorarioDto) {
    const realPuestoId = await this.resolveRealPuestoId(puestoId);
    const payload: any = {
      puesto_id: realPuestoId,
      nombre_horario: dto.nombre_horario,
      hora_entrada: dto.hora_entrada,
      hora_salida: dto.hora_salida,
      es_jornada_partida: !!dto.es_jornada_partida,
      hora_entrada_2: dto.hora_entrada_2 || null,
      hora_salida_2: dto.hora_salida_2 || null,
      tolerancia_entrada_minutos: dto.tolerancia_entrada_minutos ?? 10,
      tolerancia_salida_minutos: dto.tolerancia_salida_minutos ?? 10,
      dias_semana: dto.dias_semana || [1, 2, 3, 4, 5, 6],
      activo: dto.activo ?? true,
    };

    const { data, error } = await this.adminClient
      .from('puestos_horarios_asistencia')
      .insert(payload)
      .select()
      .single();

    if (error) {
      this.logger.error(`Error creando horario: ${error.message}`);
      throw error;
    }
    return data;
  }

  async updateHorario(id: number, dto: Partial<CreateHorarioDto>) {
    const payload: any = {
      ...dto,
      updated_at: new Date().toISOString(),
    };
    if (dto.es_jornada_partida !== undefined) {
      payload.es_jornada_partida = !!dto.es_jornada_partida;
    }
    if (dto.hora_entrada_2 !== undefined) {
      payload.hora_entrada_2 = dto.hora_entrada_2 || null;
    }
    if (dto.hora_salida_2 !== undefined) {
      payload.hora_salida_2 = dto.hora_salida_2 || null;
    }

    const { data, error } = await this.adminClient
      .from('puestos_horarios_asistencia')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      this.logger.error(`Error actualizando horario ${id}: ${error.message}`);
      throw error;
    }
    return data;
  }

  async deleteHorario(id: number) {
    const { error } = await this.adminClient
      .from('puestos_horarios_asistencia')
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  }

  // ==========================================================================
  // 3. ENLACES PÚBLICOS DE RECOPILACIÓN
  // ==========================================================================

  async getEnlaces(puestoId: number) {
    const realPuestoId = await this.resolveRealPuestoId(puestoId);
    const { data, error } = await this.adminClient
      .from('asistencia_iot_enlaces')
      .select('*, horario:puestos_horarios_asistencia(id, nombre_horario, hora_entrada, hora_salida, es_jornada_partida, hora_entrada_2, hora_salida_2)')
      .eq('puesto_id', realPuestoId)
      .eq('activo', true)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Error obteniendo enlaces del puesto ${realPuestoId}: ${error.message}`);
      throw error;
    }
    return data || [];
  }

  async createEnlace(puestoId: number, dto: CreateEnlaceDto, creadoPor?: any) {
    const realPuestoId = await this.resolveRealPuestoId(puestoId);
    const token = crypto.randomBytes(16).toString('hex');
    let userIdNum: number | null = null;
    if (typeof creadoPor === 'number' && !isNaN(creadoPor)) {
      userIdNum = creadoPor;
    } else if (creadoPor && typeof creadoPor === 'object' && creadoPor.id) {
      userIdNum = Number(creadoPor.id);
    } else if (creadoPor && !isNaN(Number(creadoPor))) {
      userIdNum = Number(creadoPor);
    }

    const { data, error } = await this.adminClient
      .from('asistencia_iot_enlaces')
      .insert({
        puesto_id: realPuestoId,
        horario_id: dto.horario_id || null,
        nombre_enlace: dto.nombre_enlace,
        codigo_seguridad: dto.codigo_seguridad || null,
        token_publico: token,
        creado_por: userIdNum,
        activo: true,
      })
      .select('*, horario:puestos_horarios_asistencia(id, nombre_horario, hora_entrada, hora_salida, es_jornada_partida, hora_entrada_2, hora_salida_2)')
      .single();

    if (error) {
      this.logger.error(`Error creando enlace para puesto ${realPuestoId}: ${error.message}`);
      throw error;
    }
    return data;
  }

  async deleteEnlace(id: number) {
    const { error } = await this.adminClient
      .from('asistencia_iot_enlaces')
      .update({ activo: false })
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  }

  // Público
  async getPublicEnlaceInfo(token: string) {
    const { data: enlace, error } = await this.adminClient
      .from('asistencia_iot_enlaces')
      .select('*, puesto:puestos_trabajo(id, nombre, direccion, ciudad)')
      .eq('token_publico', token)
      .eq('activo', true)
      .maybeSingle();

    if (error || !enlace) {
      throw new NotFoundException('El enlace de registro no existe o ha expirado');
    }

    // Horarios del puesto disponibles (incluyendo jornada partida)
    const { data: horarios } = await this.adminClient
      .from('puestos_horarios_asistencia')
      .select('id, nombre_horario, hora_entrada, hora_salida, es_jornada_partida, hora_entrada_2, hora_salida_2')
      .eq('puesto_id', enlace.puesto_id)
      .eq('activo', true)
      .order('hora_entrada');

    return {
      enlace: {
        id: enlace.id,
        nombre_enlace: enlace.nombre_enlace,
        requiere_codigo: !!enlace.codigo_seguridad,
        puesto: enlace.puesto,
        horario_id: enlace.horario_id,
      },
      horarios: horarios || [],
    };
  }

  async submitPublicRegistro(token: string, dto: RegistroPublicoPersonalDto) {
    const { data: enlace } = await this.adminClient
      .from('asistencia_iot_enlaces')
      .select('*')
      .eq('token_publico', token)
      .eq('activo', true)
      .maybeSingle();

    if (!enlace) throw new NotFoundException('Enlace inválido o expirado');

    if (enlace.codigo_seguridad && enlace.codigo_seguridad.trim() !== '') {
      if (dto.codigo_seguridad !== enlace.codigo_seguridad) {
        throw new BadRequestException('Código de verificación incorrecto');
      }
    }

    let fotoUrl: string | null = null;
    if (dto.foto_base64 && dto.foto_base64.includes('base64,')) {
      fotoUrl = await this.subirFotoStorage(dto.foto_base64, enlace.puesto_id, dto.cedula);
    }

    const horarioFinal = dto.horario_id || enlace.horario_id || null;

    const payload = {
      puesto_id: enlace.puesto_id,
      horario_id: horarioFinal,
      nombre_completo: dto.nombre_completo.trim(),
      cedula: dto.cedula.trim(),
      telefono: dto.telefono?.trim() || null,
      correo: dto.correo?.trim() || null,
      cargo: dto.cargo?.trim() || null,
      foto_rostro_url: fotoUrl,
      activo: true,
      updated_at: new Date().toISOString(),
    };

    const { data: personal, error } = await this.adminClient
      .from('asistencia_iot_personal')
      .upsert(payload, { onConflict: 'puesto_id,cedula' })
      .select()
      .single();

    if (error) {
      this.logger.error(`Error guardando personal recopilacion: ${error.message}`);
      throw error;
    }

    // Disparar sincronización asíncrona con el hardware Dahua si el puesto tiene dispositivo vinculado
    this.sincronizarHardwarePuesto(enlace.puesto_id, personal).catch((err) => {
      this.logger.warn(`No se pudo sincronizar automáticamente al hardware: ${err.message}`);
    });

    return {
      success: true,
      mensaje: 'Registro de asistencia biométrica completado con éxito',
      personal,
    };
  }

  // ==========================================================================
  // 4. PERSONAL ENROLADO EN EL PUESTO
  // ==========================================================================

  async getPersonal(puestoId: number) {
    const realPuestoId = await this.resolveRealPuestoId(puestoId);
    const { data, error } = await this.adminClient
      .from('asistencia_iot_personal')
      .select('*, horario:puestos_horarios_asistencia(id, nombre_horario, hora_entrada, hora_salida, es_jornada_partida, hora_entrada_2, hora_salida_2)')
      .eq('puesto_id', realPuestoId)
      .eq('activo', true)
      .order('nombre_completo');

    if (error) throw error;
    return data || [];
  }

  async createPersonalManual(puestoId: number, dto: CreatePersonalManualDto) {
    const realPuestoId = await this.resolveRealPuestoId(puestoId);
    const payload = {
      puesto_id: realPuestoId,
      horario_id: dto.horario_id || null,
      nombre_completo: dto.nombre_completo.trim(),
      cedula: dto.cedula.trim(),
      telefono: dto.telefono?.trim() || null,
      correo: dto.correo?.trim() || null,
      cargo: dto.cargo?.trim() || null,
      foto_rostro_url: dto.foto_rostro_url || null,
      activo: true,
    };

    const { data, error } = await this.adminClient
      .from('asistencia_iot_personal')
      .upsert(payload, { onConflict: 'puesto_id,cedula' })
      .select('*, horario:puestos_horarios_asistencia(id, nombre_horario, hora_entrada, hora_salida, es_jornada_partida, hora_entrada_2, hora_salida_2)')
      .single();

    if (error) throw error;

    this.sincronizarHardwarePuesto(realPuestoId, data).catch(() => null);
    return data;
  }

  async deletePersonal(id: number) {
    const { error } = await this.adminClient
      .from('asistencia_iot_personal')
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  }

  // ==========================================================================
  // 5. REGISTROS & LÓGICA BIOMÉTRICA DE ASISTENCIA (+-10 min & Anti-Rebote)
  // ==========================================================================

  async getRegistros(puestoId: number, fechaInicio?: string, fechaFin?: string) {
    const realPuestoId = await this.resolveRealPuestoId(puestoId);
    let query = this.adminClient
      .from('asistencia_iot_registros')
      .select('*, personal:asistencia_iot_personal(id, nombre_completo, cedula, cargo, foto_rostro_url), horario:puestos_horarios_asistencia(id, nombre_horario, hora_entrada, hora_salida, es_jornada_partida, hora_entrada_2, hora_salida_2)')
      .eq('puesto_id', realPuestoId)
      .order('hora_entrada_real', { ascending: false });

    if (fechaInicio) query = query.gte('fecha', fechaInicio);
    if (fechaFin) query = query.lte('fecha', fechaFin);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  /**
   * Procesa una lectura biométrica recibida de un dispositivo Dahua/Hikvision
   * Aplica:
   * 1. Búsqueda de persona en el puesto
   * 2. Búsqueda del horario correspondiente
   * 3. Regla +-10 minutos (Temprano / A tiempo / Tarde)
   * 4. Anti-rebote (bloquea lecturas redundantes intermedias)
   * 5. Marcación de salida
   */
  async procesarLecturaBiometrica(params: {
    dispositivo_id: string;
    cedula?: string;
    nombre?: string;
    foto_url?: string;
    timestamp?: string;
    detalles_raw?: any;
  }) {
    const { dispositivo_id, cedula, foto_url, timestamp, detalles_raw } = params;
    if (!cedula && !params.nombre) return null;

    // Buscar puesto asociado al dispositivo
    const { data: config } = await this.adminClient
      .from('puestos_asistencia_iot_config')
      .select('puesto_id, iot_activo, tolerancia_minutos')
      .eq('dispositivo_iot_id', dispositivo_id)
      .eq('iot_activo', true)
      .maybeSingle();

    if (!config) {
      return null; // El dispositivo no tiene IoT activo para asistencia en ningún puesto
    }

    const puestoId = config.puesto_id;
    const toleranciaMin = config.tolerancia_minutos || 10;

    // Buscar personal en el puesto
    let queryPersonal = this.adminClient
      .from('asistencia_iot_personal')
      .select('*, horario:puestos_horarios_asistencia(*)')
      .eq('puesto_id', puestoId)
      .eq('activo', true);

    if (cedula) {
      queryPersonal = queryPersonal.eq('cedula', cedula);
    } else if (params.nombre) {
      queryPersonal = queryPersonal.ilike('nombre_completo', `%${params.nombre}%`);
    }

    const { data: persona } = await queryPersonal.maybeSingle();
    if (!persona) {
      this.logger.debug(`Persona ${cedula || params.nombre} no está registrada en puesto ${puestoId}`);
      return null;
    }

    const eventDate = timestamp ? new Date(timestamp) : new Date();
    const hoyStr = eventDate.toISOString().split('T')[0];
    const eventTimeMinutes = eventDate.getHours() * 60 + eventDate.getMinutes();

    // Obtener horarios disponibles del puesto
    let horario = persona.horario;
    if (!horario) {
      const { data: horarios } = await this.adminClient
        .from('puestos_horarios_asistencia')
        .select('*')
        .eq('puesto_id', puestoId)
        .eq('activo', true);

      // Encontrar el horario más cercano a la hora actual
      if (horarios && horarios.length > 0) {
        horario = this.encontrarHorarioMasCercano(horarios, eventTimeMinutes);
      }
    }

    let horaEntradaProg = horario?.hora_entrada || '08:00:00';
    let horaSalidaProg = horario?.hora_salida || '17:00:00';
    let tramoActual = 'unico';

    // Soporte para Jornada Partida / Discontinua (ej: 8:00 a 12:00 y 14:00 a 18:00)
    if (horario?.es_jornada_partida && horario?.hora_entrada_2 && horario?.hora_salida_2) {
      const sal1Min = this.timeStringToMinutes(horario.hora_salida);
      const ent2Min = this.timeStringToMinutes(horario.hora_entrada_2);
      const midPoint = Math.floor((sal1Min + ent2Min) / 2); // ej: 13:00 (1:00 PM)

      if (eventTimeMinutes >= midPoint) {
        tramoActual = 'tarde';
        horaEntradaProg = horario.hora_entrada_2;
        horaSalidaProg = horario.hora_salida_2;
      } else {
        tramoActual = 'mañana';
        horaEntradaProg = horario.hora_entrada;
        horaSalidaProg = horario.hora_salida;
      }
    }

    const progEntradaMin = this.timeStringToMinutes(horaEntradaProg);
    const progSalidaMin = this.timeStringToMinutes(horaSalidaProg);

    // Verificar si ya tiene registro para hoy en este tramo horario
    const { data: regHoy } = await this.adminClient
      .from('asistencia_iot_registros')
      .select('*')
      .eq('puesto_id', puestoId)
      .eq('personal_id', persona.id)
      .eq('fecha', hoyStr)
      .eq('tramo_horario', tramoActual)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // ========================================================================
    // CASO 1: YA TIENE ENTRADA HOY -> EVALUAR SALIDA O ANTI-REBOTE
    // ========================================================================
    if (regHoy) {
      // Si la lectura está dentro del período de BLOQUEO ANTI-REBOTE -> IGNORAR
      if (regHoy.bloqueado_hasta && eventDate.getTime() < new Date(regHoy.bloqueado_hasta).getTime()) {
        this.logger.debug(`[Anti-Rebote] Ignorando marcación repetida para ${persona.nombre_completo} hasta ${regHoy.bloqueado_hasta}`);
        return { ignorado_antirebote: true, registro_id: regHoy.id };
      }

      // Si aún no tiene salida y ya está en ventana de salida (o después de su inicio)
      if (!regHoy.hora_salida_real && eventTimeMinutes > progEntradaMin + 30) {
        let estadoSalida = 'cumplido';
        if (eventTimeMinutes < progSalidaMin - toleranciaMin) {
          estadoSalida = 'anticipado';
        } else if (eventTimeMinutes > progSalidaMin + 30) {
          estadoSalida = 'extra';
        }

        const { data: updated } = await this.adminClient
          .from('asistencia_iot_registros')
          .update({
            hora_salida_real: eventDate.toISOString(),
            estado_salida: estadoSalida,
            foto_salida_url: foto_url || persona.foto_rostro_url,
            estado_general: 'finalizado',
          })
          .eq('id', regHoy.id)
          .select()
          .single();

        this.logger.log(`✅ [Asistencia IoT] Salida registrada: ${persona.nombre_completo} [${tramoActual}] (${estadoSalida})`);
        return updated;
      }

      return { ya_registrado: true, registro_id: regHoy.id };
    }

    // ========================================================================
    // CASO 2: NUEVA ENTRADA
    // ========================================================================
    let estadoEntrada = 'a_tiempo';
    let minutosTardanza = 0;

    // Comparar con hora de entrada programada
    const diffEntrada = eventTimeMinutes - progEntradaMin;

    if (diffEntrada < -toleranciaMin) {
      estadoEntrada = 'temprano';
    } else if (diffEntrada <= toleranciaMin) {
      estadoEntrada = 'a_tiempo';
    } else {
      estadoEntrada = 'tarde';
      minutosTardanza = diffEntrada;
    }

    // Calcular hora de bloqueo anti-rebote:
    // Bloquear hasta 30 minutos antes de la hora de salida programada,
    // o al menos 2 horas después de la entrada
    let bloqueoTimestamp = new Date(eventDate.getTime() + 2 * 60 * 60 * 1000);
    if (progSalidaMin > eventTimeMinutes) {
      const salidaDate = new Date(eventDate);
      const [hS, mS] = horaSalidaProg.split(':').map(Number);
      salidaDate.setHours(hS, mS - toleranciaMin, 0, 0);
      if (salidaDate.getTime() > eventDate.getTime()) {
        bloqueoTimestamp = salidaDate;
      }
    }

    const { data: nuevoRegistro, error: regErr } = await this.adminClient
      .from('asistencia_iot_registros')
      .insert({
        puesto_id: puestoId,
        personal_id: persona.id,
        dispositivo_id: dispositivo_id,
        horario_id: horario?.id || null,
        tramo_horario: tramoActual,
        fecha: hoyStr,
        hora_entrada_programada: horaEntradaProg,
        hora_entrada_real: eventDate.toISOString(),
        estado_entrada: estadoEntrada,
        minutos_tardanza: minutosTardanza,
        foto_entrada_url: foto_url || persona.foto_rostro_url,
        hora_salida_programada: horaSalidaProg,
        bloqueado_hasta: bloqueoTimestamp.toISOString(),
        estado_general: 'presente',
        metodo_marcacion: 'facial',
        detalles_raw: detalles_raw || null,
      })
      .select()
      .single();

    if (regErr) {
      this.logger.error(`Error guardando registro asistencia IoT: ${regErr.message}`);
      throw regErr;
    }

    this.logger.log(`✅ [Asistencia IoT] Entrada registrada: ${persona.nombre_completo} (${estadoEntrada}, demora: ${minutosTardanza}m)`);
    return nuevoRegistro;
  }

  async registrarMarcacionManual(puestoId: number, dto: ProcesarMarcacionManualDto) {
    const realPuestoId = await this.resolveRealPuestoId(puestoId);
    const { data: persona } = await this.adminClient
      .from('asistencia_iot_personal')
      .select('*, horario:puestos_horarios_asistencia(*)')
      .eq('id', dto.personal_id)
      .single();

    if (!persona) throw new NotFoundException('Personal no encontrado');

    const eventDate = dto.hora ? new Date(dto.hora) : new Date();
    const hoyStr = eventDate.toISOString().split('T')[0];

    if (dto.tipo === 'entrada') {
      const horaEntradaProg = persona.horario?.hora_entrada || '08:00:00';
      const horaSalidaProg = persona.horario?.hora_salida || '17:00:00';

      const progMin = this.timeStringToMinutes(horaEntradaProg);
      const actualMin = eventDate.getHours() * 60 + eventDate.getMinutes();
      const diff = actualMin - progMin;
      const estado = diff > 10 ? 'tarde' : 'a_tiempo';

      const { data, error } = await this.adminClient
        .from('asistencia_iot_registros')
        .insert({
          puesto_id: realPuestoId,
          personal_id: persona.id,
          fecha: hoyStr,
          hora_entrada_programada: horaEntradaProg,
          hora_entrada_real: eventDate.toISOString(),
          estado_entrada: estado,
          minutos_tardanza: diff > 10 ? diff : 0,
          hora_salida_programada: horaSalidaProg,
          estado_general: 'presente',
          metodo_marcacion: 'manual',
          detalles_raw: { observacion: dto.observacion || 'Registro manual por administrador' },
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      // Salida
      const { data: reg } = await this.adminClient
        .from('asistencia_iot_registros')
        .select('*')
        .eq('puesto_id', realPuestoId)
        .eq('personal_id', persona.id)
        .eq('fecha', hoyStr)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!reg) throw new BadRequestException('No existe registro de entrada para hoy');

      const { data, error } = await this.adminClient
        .from('asistencia_iot_registros')
        .update({
          hora_salida_real: eventDate.toISOString(),
          estado_salida: 'cumplido',
          estado_general: 'finalizado',
        })
        .eq('id', reg.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  }

  // ==========================================================================
  // 6. REPORTES (POR PUESTO Y GLOBAL)
  // ==========================================================================

  async getReportePuesto(puestoId: number, fechaInicio: string, fechaFin: string) {
    const puesto = await this.resolveRealPuesto(puestoId);
    if (!puesto) throw new NotFoundException('Puesto no encontrado');

    const { data: registros, error } = await this.adminClient
      .from('asistencia_iot_registros')
      .select('*, personal:asistencia_iot_personal(id, nombre_completo, cedula, cargo), horario:puestos_horarios_asistencia(nombre_horario, es_jornada_partida)')
      .eq('puesto_id', puesto.id)
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin)
      .order('fecha', { ascending: true })
      .order('hora_entrada_real', { ascending: true });

    if (error) throw error;

    const totalRegistros = registros?.length || 0;
    let aTiempo = 0;
    let tarde = 0;
    let temprano = 0;
    let minutosRetrasoTotal = 0;

    const porPersona: Record<number, any> = {};

    (registros || []).forEach((r: any) => {
      if (r.estado_entrada === 'a_tiempo') aTiempo++;
      else if (r.estado_entrada === 'tarde') {
        tarde++;
        minutosRetrasoTotal += r.minutos_tardanza || 0;
      } else if (r.estado_entrada === 'temprano') temprano++;

      const pId = r.personal_id;
      if (!porPersona[pId]) {
        porPersona[pId] = {
          personal: r.personal,
          total: 0,
          a_tiempo: 0,
          tarde: 0,
          minutos_retraso: 0,
          registros: [],
        };
      }
      porPersona[pId].total++;
      if (r.estado_entrada === 'tarde') {
        porPersona[pId].tarde++;
        porPersona[pId].minutos_retraso += r.minutos_tardanza || 0;
      } else {
        porPersona[pId].a_tiempo++;
      }
      porPersona[pId].registros.push(r);
    });

    return {
      puesto,
      rango: { fechaInicio, fechaFin },
      metricas: {
        total_marcaciones: totalRegistros,
        a_tiempo: aTiempo,
        temprano: temprano,
        tarde: tarde,
        porcentaje_puntualidad: totalRegistros > 0 ? Math.round(((aTiempo + temprano) / totalRegistros) * 100) : 100,
        minutos_retraso_total: minutosRetrasoTotal,
      },
      detalles_por_persona: Object.values(porPersona),
      registros: registros || [],
    };
  }

  async getReporteGlobal(fechaInicio: string, fechaFin: string) {
    const { data: registros, error } = await this.adminClient
      .from('asistencia_iot_registros')
      .select('*, puesto:puestos_trabajo(id, nombre, codigo_puesto), personal:asistencia_iot_personal(id, nombre_completo, cedula)')
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin)
      .order('fecha', { ascending: false });

    if (error) throw error;

    const total = registros?.length || 0;
    let aTiempo = 0;
    let tarde = 0;
    let minutosRetraso = 0;

    const porPuesto: Record<number, any> = {};

    (registros || []).forEach((r: any) => {
      if (r.estado_entrada === 'tarde') {
        tarde++;
        minutosRetraso += r.minutos_tardanza || 0;
      } else {
        aTiempo++;
      }

      const pId = r.puesto_id;
      if (!porPuesto[pId]) {
        porPuesto[pId] = {
          puesto: r.puesto,
          total: 0,
          a_tiempo: 0,
          tarde: 0,
          minutos_retraso: 0,
        };
      }
      porPuesto[pId].total++;
      if (r.estado_entrada === 'tarde') {
        porPuesto[pId].tarde++;
        porPuesto[pId].minutos_retraso += r.minutos_tardanza || 0;
      } else {
        porPuesto[pId].a_tiempo++;
      }
    });

    return {
      rango: { fechaInicio, fechaFin },
      metricas: {
        total_marcaciones: total,
        a_tiempo: aTiempo,
        tarde: tarde,
        porcentaje_puntualidad: total > 0 ? Math.round((aTiempo / total) * 100) : 100,
        minutos_retraso_total: minutosRetraso,
      },
      puestos_resumen: Object.values(porPuesto),
    };
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private async subirFotoStorage(base64Data: string, puestoId: number, cedula: string): Promise<string> {
    try {
      const parts = base64Data.split(';base64,');
      const mime = parts[0].replace('data:', '') || 'image/jpeg';
      const buffer = Buffer.from(parts[1], 'base64');
      const ext = mime.includes('png') ? 'png' : 'jpg';
      const fileName = `puesto_${puestoId}/${cedula}_${Date.now()}.${ext}`;

      // Subida directa al bucket Supabase Storage en la VPS
      const { error: uploadError } = await this.vpsStorage
        .from('asistencia-iot-faces')
        .upload(fileName, buffer, { contentType: mime, upsert: true });

      if (uploadError) {
        this.logger.warn(`Fallback de subida a control-acceso-faces: ${uploadError.message}`);
        const { error: fallbackErr } = await this.vpsStorage
          .from('control-acceso-faces')
          .upload(fileName, buffer, { contentType: mime, upsert: true });

        if (fallbackErr) throw fallbackErr;
        const { data: pubFallback } = this.vpsStorage
          .from('control-acceso-faces')
          .getPublicUrl(fileName);
        return pubFallback.publicUrl;
      }

      const { data: pub } = this.vpsStorage
        .from('asistencia-iot-faces')
        .getPublicUrl(fileName);

      this.logger.log(`✅ Foto facial almacenada en Supabase Storage VPS: ${pub.publicUrl}`);
      return pub.publicUrl;
    } catch (e: any) {
      this.logger.warn(`Error al subir foto a Supabase storage VPS: ${e.message}`);
      return base64Data; // fallback
    }
  }

  private async sincronizarHardwarePuesto(puestoId: number, personal: any) {
    const { data: cfg } = await this.adminClient
      .from('puestos_asistencia_iot_config')
      .select('*, dispositivo:dispositivos_iot(*)')
      .eq('puesto_id', puestoId)
      .eq('iot_activo', true)
      .maybeSingle();

    if (!cfg || !cfg.dispositivo) return;

    const dev = cfg.dispositivo;
    // Si es Dahua y tenemos foto
    if (personal.foto_rostro_url && (dev.tipo_dispositivo === 'dahua' || dev.ip_direccion)) {
      this.logger.log(`🔄 Sincronizando personal ${personal.nombre_completo} (${personal.cedula}) a terminal Dahua ${dev.nombre_identificador}...`);
      // Llamada segura a DahuaService
      try {
        const ip = dev.ip_direccion;
        const port = dev.puerto_servicio || dev.configuracion_tecnica?.puerto || 80;
        const user = dev.credencial_usuario || 'admin';
        const pass = dev.credencial_password || '';

        await this.dahuaService.agregarPersona(ip, port, user, pass, {
          userId: personal.cedula,
          nombre: personal.nombre_completo,
          codigoTarjeta: personal.cedula,
          habilitado: true,
        });

        await this.adminClient
          .from('asistencia_iot_personal')
          .update({ sincronizado_dispositivo: true, dispositivo_user_id: personal.cedula })
          .eq('id', personal.id);

        this.logger.log(`✅ Personal ${personal.nombre_completo} sincronizado a hardware`);
      } catch (err: any) {
        this.logger.warn(`⚠️ Error sincronizando a terminal Dahua: ${err.message}`);
      }
    }
  }

  private timeStringToMinutes(timeStr: string): number {
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  private encontrarHorarioMasCercano(horarios: any[], currentMinutes: number): any {
    let closest = horarios[0];
    let minDiff = 9999;
    for (const h of horarios) {
      const hMin = this.timeStringToMinutes(h.hora_entrada);
      const diff = Math.abs(currentMinutes - hMin);
      if (diff < minDiff) {
        minDiff = diff;
        closest = h;
      }
    }
    return closest;
  }
}
