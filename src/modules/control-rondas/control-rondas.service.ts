import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { createHash, randomBytes } from "crypto";
import { SupabaseService } from "../supabase/supabase.service";
import {
  BulkPuntosControlDto,
  FinalizarRondaControlDto,
  IniciarRondaControlDto,
  RegistrarLecturaControlDto,
  UpsertConfiguracionRondaDto,
  UpsertPuntoControlDto,
} from "./dto/control-rondas.dto";

@Injectable()
export class ControlRondasService {
  private readonly logger = new Logger(ControlRondasService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async dashboard() {
    const supabase = this.supabaseService.getClient();
    const { data: puestos, error } = await supabase
      .from("v_rondas_puestos_resumen")
      .select("*")
      .order("puesto_nombre", { ascending: true });

    if (error) throw new BadRequestException(error.message);

    const rows = puestos || [];
    const activos = rows.filter((p) => p.rondas_activas);
    const rondasHoy = rows.reduce((sum, p) => sum + Number(p.rondas_hoy || 0), 0);
    const completadasHoy = rows.reduce((sum, p) => sum + Number(p.rondas_completadas_hoy || 0), 0);

    return {
      puestos: rows,
      metricas: {
        total_puestos: rows.length,
        puestos_con_ronda: activos.length,
        puntos_activos: rows.reduce((sum, p) => sum + Number(p.puntos_activos || 0), 0),
        rondas_hoy: rondasHoy,
        rondas_completadas_hoy: completadasHoy,
        cumplimiento_hoy: rondasHoy ? Math.round((completadasHoy / rondasHoy) * 100) : 0,
      },
    };
  }

  async getEnCurso() {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from("rondas_ejecuciones_control")
      .select(`
        *,
        empleado:empleados(id,nombre_completo,cedula),
        puesto:puestos_trabajo(id,nombre,codigo_puesto,direccion,ciudad,latitud,longitud),
        configuracion:rondas_configuracion_puesto(id,nombre,frecuencia_minutos,duracion_objetivo_minutos)
      `)
      .eq("estado", "en_proceso")
      .order("inicio_real", { ascending: false });

    if (error) throw new BadRequestException(error.message);

    const ejecuciones = await Promise.all(
      (data || []).map(async (ronda) => {
        const { data: eventos } = await supabase
          .from("rondas_tracking_eventos")
          .select("*")
          .eq("ejecucion_id", ronda.id)
          .order("created_at", { ascending: false })
          .limit(10);

        const ultimoGps = (eventos || []).find((evento) => evento.latitud && evento.longitud);
        return {
          ...ronda,
          ultimo_evento: eventos?.[0] || null,
          ultimo_gps: ultimoGps || null,
          tracking_reciente: eventos || [],
        };
      }),
    );

    return {
      total: ejecuciones.length,
      ejecuciones,
    };
  }

  async getPuestoControl(puestoId: number) {
    const supabase = this.supabaseService.getClient();
    const { data: puesto, error: puestoError } = await supabase
      .from("puestos_trabajo")
      .select("id,nombre,codigo_puesto,direccion,ciudad,activo,latitud,longitud")
      .eq("id", puestoId)
      .single();

    if (puestoError || !puesto) throw new NotFoundException("Puesto no encontrado");

    const { data: configuracion } = await supabase
      .from("rondas_configuracion_puesto")
      .select("*, puntos:rondas_puntos_control(*), programacion:rondas_programacion(*)")
      .eq("puesto_id", puestoId)
      .maybeSingle();

    const { data: ejecuciones, error: ejecucionesError } = await supabase
      .from("rondas_ejecuciones_control")
      .select("*, empleado:empleados(id,nombre_completo,cedula)")
      .eq("puesto_id", puestoId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (ejecucionesError) throw new BadRequestException(ejecucionesError.message);

    const resumenEjecuciones = (ejecuciones || []).reduce(
      (acc, ejecucion) => {
        const estado = String(ejecucion.estado || "sin_estado").toLowerCase();
        acc[estado] = (acc[estado] || 0) + 1;
        acc.total += 1;
        return acc;
      },
      { total: 0 } as Record<string, number>,
    );

    return {
      puesto,
      configuracion: configuracion
        ? {
            ...configuracion,
            puntos: (configuracion.puntos || []).sort((a, b) => a.orden - b.orden),
          }
        : null,
      resumen_ejecuciones: resumenEjecuciones,
      ejecuciones: ejecuciones || [],
    };
  }

  async upsertConfiguracion(dto: UpsertConfiguracionRondaDto, userId?: number) {
    const supabase = this.supabaseService.getClient();
    const { data: puesto } = await supabase
      .from("puestos_trabajo")
      .select("id,nombre")
      .eq("id", dto.puesto_id)
      .single();

    if (!puesto) throw new NotFoundException("Puesto no encontrado");

    const payload = {
      nombre: dto.nombre || `Ronda principal - ${puesto.nombre}`,
      descripcion: dto.descripcion,
      activo: dto.activo ?? true,
      frecuencia_minutos: dto.frecuencia_minutos ?? 60,
      duracion_objetivo_minutos: dto.duracion_objetivo_minutos ?? 30,
      requiere_orden: dto.requiere_orden ?? true,
      requiere_foto_cierre: dto.requiere_foto_cierre ?? true,
      requiere_gps: dto.requiere_gps ?? true,
      radio_geocerca_metros: dto.radio_geocerca_metros ?? 60,
      modo_antifraude: dto.modo_antifraude || "qr_gps_foto_tracking",
      actualizado_por: userId,
    };

    const { data: existing } = await supabase
      .from("rondas_configuracion_puesto")
      .select("id")
      .eq("puesto_id", dto.puesto_id)
      .maybeSingle();

    if (existing?.id) {
      const { data, error } = await supabase
        .from("rondas_configuracion_puesto")
        .update(payload)
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw new BadRequestException(error.message);
      return data;
    }

    const { data, error } = await supabase
      .from("rondas_configuracion_puesto")
      .insert({ ...payload, puesto_id: dto.puesto_id, creado_por: userId })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async upsertPunto(configuracionId: number, dto: UpsertPuntoControlDto) {
    const supabase = this.supabaseService.getClient();
    await this.assertConfiguracion(configuracionId);

    const basePayload: any = {
      configuracion_id: configuracionId,
      nombre: dto.nombre,
      descripcion: dto.descripcion,
      instrucciones: dto.instrucciones,
      orden: dto.orden,
      obligatorio: dto.obligatorio ?? true,
      activo: dto.activo ?? true,
      latitud: dto.latitud,
      longitud: dto.longitud,
      radio_metros: dto.radio_metros ?? 35,
      requiere_foto: dto.requiere_foto ?? false,
    };

    if (dto.id) {
      const { data, error } = await supabase
        .from("rondas_puntos_control")
        .update(basePayload)
        .eq("id", dto.id)
        .eq("configuracion_id", configuracionId)
        .select()
        .single();
      if (error) throw new BadRequestException(error.message);
      return this.ensureQrPayload(data);
    }

    const secret = randomBytes(32).toString("hex");
    const { data, error } = await supabase
      .from("rondas_puntos_control")
      .insert({ ...basePayload, qr_static_secret: secret })
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return this.ensureQrPayload(data);
  }

  async replacePuntos(configuracionId: number, dto: BulkPuntosControlDto) {
    const results: any[] = [];
    for (const punto of dto.puntos) {
      results.push(await this.upsertPunto(configuracionId, punto));
    }
    return results;
  }

  async rotateQr(puntoId: number) {
    const supabase = this.supabaseService.getClient();
    const secret = randomBytes(32).toString("hex");
    const { data, error } = await supabase
      .from("rondas_puntos_control")
      .update({ qr_static_secret: secret, qr_version: Math.floor(Date.now() / 1000) })
      .eq("id", puntoId)
      .select()
      .single();

    if (error || !data) throw new NotFoundException("Punto de control no encontrado");
    return this.ensureQrPayload(data);
  }

  async iniciar(dto: IniciarRondaControlDto, requestUser: any) {
    const supabase = this.supabaseService.getClient();
    const { data: config } = await supabase
      .from("rondas_configuracion_puesto")
      .select("*, puntos:rondas_puntos_control(id,obligatorio,activo)")
      .eq("id", dto.configuracion_id)
      .single();

    if (!config) throw new NotFoundException("Configuración de ronda no encontrada");
    const puntosActivos = (config.puntos || []).filter((p) => p.activo);
    if (!puntosActivos.length) throw new BadRequestException("La ronda no tiene puntos de control activos");

    const empleadoId = dto.empleado_id || requestUser?.empleado_id || requestUser?.id;
    const now = new Date();
    const fin = new Date(now.getTime() + Number(config.duracion_objetivo_minutos || 30) * 60000);

    const { data, error } = await supabase
      .from("rondas_ejecuciones_control")
      .insert({
        configuracion_id: config.id,
        puesto_id: config.puesto_id,
        empleado_id: empleadoId,
        estado: "en_proceso",
        inicio_real: now.toISOString(),
        fin_programado: fin.toISOString(),
        puntos_totales: puntosActivos.length,
        puntos_obligatorios: puntosActivos.filter((p) => p.obligatorio).length,
        dispositivo_id: dto.dispositivo_id,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    await this.track(data.id, empleadoId, "inicio", { dispositivo_id: dto.dispositivo_id });
    return data;
  }

  async registrarLectura(ejecucionId: number, dto: RegistrarLecturaControlDto, user: any) {
    const supabase = this.supabaseService.getClient();
    const { data: ejecucion } = await supabase
      .from("rondas_ejecuciones_control")
      .select("*, configuracion:rondas_configuracion_puesto(*)")
      .eq("id", ejecucionId)
      .single();

    if (!ejecucion) throw new NotFoundException("Ejecución de ronda no encontrada");
    if (ejecucion.estado !== "en_proceso") throw new BadRequestException("La ronda no está en proceso");

    const { data: punto } = await supabase
      .from("rondas_puntos_control")
      .select("*")
      .eq("id", dto.punto_id)
      .eq("configuracion_id", ejecucion.configuracion_id)
      .single();

    if (!punto) throw new BadRequestException("El punto no pertenece a esta ronda");

    const validation = await this.validarLectura(ejecucion, punto, dto);
    const empleadoId = user?.empleado_id || ejecucion.empleado_id;
    const { data, error } = await supabase
      .from("rondas_lecturas_puntos")
      .insert({
        ejecucion_id: ejecucionId,
        punto_id: punto.id,
        empleado_id: empleadoId,
        estado: validation.estado,
        orden_detectado: punto.orden,
        qr_payload_recibido: dto.qr_payload_recibido,
        qr_hash: this.sha256(dto.qr_payload_recibido || ""),
        latitud: dto.latitud,
        longitud: dto.longitud,
        precision_metros: dto.precision_metros,
        distancia_punto_metros: validation.distancia,
        evidencia_foto_url: dto.evidencia_foto_url,
        evidencia_foto_path: dto.evidencia_foto_path,
        comentario: dto.comentario,
        validaciones: validation.validaciones,
        score_antifraude: validation.score,
        motivo_rechazo: validation.motivo,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    await this.recalcularEjecucion(ejecucionId);
    await this.track(ejecucionId, empleadoId, validation.estado === "valida" ? "punto_validado" : "punto_fallido", {
      punto_id: punto.id,
      latitud: dto.latitud,
      longitud: dto.longitud,
      payload: validation,
    });

    return data;
  }

  async finalizar(ejecucionId: number, dto: FinalizarRondaControlDto) {
    const supabase = this.supabaseService.getClient();
    const resumen = await this.recalcularEjecucion(ejecucionId);
    const estado = resumen.porcentaje_cumplimiento >= 100 ? "completada" : "incompleta";
    const now = new Date();
    const { data, error } = await supabase
      .from("rondas_ejecuciones_control")
      .update({
        estado,
        resultado: estado === "completada" ? "aprobada" : "observada",
        fin_real: now.toISOString(),
        duracion_segundos: resumen.inicio_real
          ? Math.round((now.getTime() - new Date(resumen.inicio_real).getTime()) / 1000)
          : null,
        evidencia_cierre_url: dto.evidencia_cierre_url,
        evidencia_cierre_path: dto.evidencia_cierre_path,
        motivo_incompleta: estado === "incompleta" ? dto.motivo_incompleta : null,
        observaciones: dto.observaciones,
      })
      .eq("id", ejecucionId)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    await this.track(ejecucionId, data.empleado_id, "finalizacion", { payload: { estado } });
    return data;
  }

  async getTracking(ejecucionId: number) {
    const supabase = this.supabaseService.getClient();
    const { data: ejecucion } = await supabase
      .from("rondas_ejecuciones_control")
      .select("*, empleado:empleados(id,nombre_completo,cedula), puesto:puestos_trabajo(id,nombre,codigo_puesto)")
      .eq("id", ejecucionId)
      .single();

    if (!ejecucion) throw new NotFoundException("Ejecución no encontrada");

    const [{ data: lecturas }, { data: eventos }, { data: evidencias }] = await Promise.all([
      supabase
        .from("rondas_lecturas_puntos")
        .select("*, punto:rondas_puntos_control(id,nombre,orden,obligatorio)")
        .eq("ejecucion_id", ejecucionId)
        .order("leido_at", { ascending: true }),
      supabase
        .from("rondas_tracking_eventos")
        .select("*")
        .eq("ejecucion_id", ejecucionId)
        .order("created_at", { ascending: true }),
      supabase
        .from("rondas_evidencias")
        .select("*")
        .eq("ejecucion_id", ejecucionId)
        .order("created_at", { ascending: true }),
    ]);

    return { ejecucion, lecturas: lecturas || [], eventos: eventos || [], evidencias: evidencias || [] };
  }

  private async assertConfiguracion(configuracionId: number) {
    const supabase = this.supabaseService.getClient();
    const { data } = await supabase.from("rondas_configuracion_puesto").select("id").eq("id", configuracionId).single();
    if (!data) throw new NotFoundException("Configuración no encontrada");
  }

  private async ensureQrPayload(point: any) {
    const supabase = this.supabaseService.getClient();
    const payload = this.buildQrPayload(point);
    if (point.qr_payload === payload) return point;
    const { data } = await supabase
      .from("rondas_puntos_control")
      .update({ qr_payload: payload })
      .eq("id", point.id)
      .select()
      .single();
    return data || { ...point, qr_payload: payload };
  }

  private buildQrPayload(point: any): string {
    const hash = this.sha256(`${point.public_id}.${point.qr_version}.${point.qr_static_secret}`).slice(0, 24);
    return `proliseg://ronda/checkpoint?p=${point.public_id}&v=${point.qr_version}&h=${hash}`;
  }

  private async validarLectura(ejecucion: any, punto: any, dto: RegistrarLecturaControlDto) {
    let score = 100;
    const flags: string[] = [];
    let estado = "valida";
    let motivo: string | null = null;
    const distancia = dto.latitud && dto.longitud && punto.latitud && punto.longitud
      ? this.distanceMeters(Number(dto.latitud), Number(dto.longitud), Number(punto.latitud), Number(punto.longitud))
      : null;

    const expectedHash = this.buildQrPayload(punto);
    if (dto.qr_payload_recibido && dto.qr_payload_recibido !== expectedHash) {
      score -= 30;
      flags.push("qr_payload_no_coincide");
      estado = "sospechosa";
      motivo = "El QR no coincide con el punto configurado";
    }

    if (ejecucion.configuracion?.requiere_gps && distancia !== null && distancia > Number(punto.radio_metros || ejecucion.configuracion.radio_geocerca_metros || 60)) {
      score -= 35;
      flags.push("fuera_de_geocerca");
      estado = "fuera_de_geocerca";
      motivo = "La ubicación no coincide con el punto de control";
    }

    if ((punto.requiere_foto || ejecucion.configuracion?.requiere_foto_por_punto) && !dto.evidencia_foto_url && !dto.evidencia_foto_path) {
      score -= 25;
      flags.push("foto_requerida_faltante");
      estado = estado === "valida" ? "sospechosa" : estado;
      motivo = motivo || "Falta evidencia fotográfica del punto";
    }

    return {
      estado,
      score: Math.max(0, score),
      distancia,
      motivo,
      validaciones: {
        flags,
        distancia_metros: distancia,
        gps_requerido: ejecucion.configuracion?.requiere_gps,
        foto_requerida: punto.requiere_foto || ejecucion.configuracion?.requiere_foto_por_punto,
      },
    };
  }

  private async recalcularEjecucion(ejecucionId: number) {
    const supabase = this.supabaseService.getClient();
    const { data: ejecucion } = await supabase
      .from("rondas_ejecuciones_control")
      .select("*")
      .eq("id", ejecucionId)
      .single();

    const { data: lecturas } = await supabase
      .from("rondas_lecturas_puntos")
      .select("id,estado,score_antifraude")
      .eq("ejecucion_id", ejecucionId);

    const validas = (lecturas || []).filter((l) => l.estado === "valida").length;
    const total = ejecucion?.puntos_obligatorios || ejecucion?.puntos_totales || 0;
    const porcentaje = total ? Math.min(100, Number(((validas / total) * 100).toFixed(2))) : 0;
    const score = lecturas?.length
      ? Math.round((lecturas || []).reduce((sum, l) => sum + Number(l.score_antifraude || 0), 0) / lecturas.length)
      : 100;

    const { data } = await supabase
      .from("rondas_ejecuciones_control")
      .update({
        puntos_leidos: lecturas?.length || 0,
        puntos_validos: validas,
        porcentaje_cumplimiento: porcentaje,
        score_antifraude: score,
      })
      .eq("id", ejecucionId)
      .select()
      .single();

    return data || ejecucion;
  }

  private async track(ejecucionId: number, empleadoId: number, evento: string, payload: any = {}) {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.from("rondas_tracking_eventos").insert({
      ejecucion_id: ejecucionId,
      empleado_id: empleadoId,
      evento,
      punto_id: payload.punto_id,
      latitud: payload.latitud,
      longitud: payload.longitud,
      dispositivo_id: payload.dispositivo_id,
      payload: payload.payload || payload,
    });
    if (error) this.logger.warn(`No se pudo registrar tracking de ronda: ${error.message}`);
  }

  private sha256(value: string) {
    return createHash("sha256").update(value).digest("hex");
  }

  private distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
    const radius = 6371000;
    const toRad = (v: number) => (v * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
