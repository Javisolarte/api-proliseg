import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { CreateTurnoReemplazoDto, UpdateTurnoReemplazoDto, CreateTurnoReemplazoRangoDto } from "./dto/turnos_reemplazos.dto";
import { IaService } from "../ia/ia.service";

@Injectable()
export class TurnosReemplazosService {
  private readonly logger = new Logger(TurnosReemplazosService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly iaService: IaService
  ) { }

  /**
   * 🧠 Sugerir reemplazos usando IA
   */
  async sugerirReemplazoIA(turnoId: number) {
    const supabase = this.supabaseService.getClient();

    // Obtener turno con toda su información
    const { data: turno, error } = await supabase
      .from("turnos")
      .select(`
        *,
        empleado:empleado_id (
          id,
          nombre_completo
        ),
        puesto:puesto_id (
          id,
          nombre,
          ciudad,
          direccion
        ),
        subpuesto:subpuesto_id (
          id,
          nombre
        )
      `)
      .eq("id", turnoId)
      .single();

    if (error || !turno) {
      throw new NotFoundException("Turno no encontrado");
    }

    const puesto = Array.isArray(turno.puesto) ? turno.puesto[0] : turno.puesto;
    const subpuesto = Array.isArray(turno.subpuesto) ? turno.subpuesto[0] : turno.subpuesto;

    const turnoDetalle = {
      fecha: turno.fecha,
      hora_inicio: turno.hora_inicio,
      hora_fin: turno.hora_fin,
      puesto_nombre: puesto?.nombre,
      subpuesto_nombre: subpuesto?.nombre,
      ciudad: puesto?.ciudad,
      direccion: puesto?.direccion,
    };

    // Obtener empleados asignados al mismo subpuesto
    const { data: asignaciones } = await supabase
      .from("asignacion_guardas_puesto")
      .select(`
        empleado_id,
        empleado:empleado_id (
          id,
          nombre_completo,
          ciudad
        )
      `)
      .eq("subpuesto_id", turno.subpuesto_id)
      .eq("activo", true);

    const candidatosPotenciales = (asignaciones || [])
      .filter(a => a.empleado && a.empleado_id !== turno.empleado_id)
      .map(a => {
        const emp = Array.isArray(a.empleado) ? a.empleado[0] : a.empleado;
        return {
          id: emp.id,
          nombre: emp.nombre_completo,
          ciudad: emp.ciudad,
          es_su_puesto_habitual: true
        };
      });

    // Filtrar empleados que NO tengan turno ese día a esa hora
    const candidatosDisponibles: any[] = [];

    for (const emp of candidatosPotenciales) {
      const { data: turnosConflicto } = await supabase
        .from("turnos")
        .select("id")
        .eq("empleado_id", emp.id)
        .eq("fecha", turno.fecha)
        .or(`and(hora_inicio.lte.${turno.hora_fin},hora_fin.gte.${turno.hora_inicio})`);

      if (!turnosConflicto || turnosConflicto.length === 0) {
        candidatosDisponibles.push(emp);
      }
    }

    // Enviar a IA para sugerencias
    const sugerenciasIA = await this.iaService.sugerirReemplazo(turnoDetalle, candidatosDisponibles);

    return {
      turno_original: {
        id: turno.id,
        empleado: Array.isArray(turno.empleado) ? turno.empleado[0] : turno.empleado,
        fecha: turno.fecha,
        hora_inicio: turno.hora_inicio,
        hora_fin: turno.hora_fin,
        puesto: puesto?.nombre,
        subpuesto: subpuesto?.nombre,
      },
      candidatos_disponibles: candidatosDisponibles.length,
      sugerencias: sugerenciasIA
    };
  }

  /**
   * ✅ Crear reemplazo de turno
   * - Marca el turno original como reemplazado
   * - Reasigna el turno al empleado de reemplazo
   * - Registra el reemplazo en turnos_reemplazos
   */
  async create(dto: CreateTurnoReemplazoDto) {
    const supabase = this.supabaseService.getClient();

    this.logger.log(`🔄 Iniciando reemplazo de turno ${dto.turno_original_id}`);

    // 1️⃣ Obtener y validar turno original
    const { data: turnoOriginal, error: turnoError } = await supabase
      .from("turnos")
      .select(`
        *,
        empleado:empleado_id (
          id,
          nombre_completo
        ),
        subpuesto:subpuesto_id (
          id,
          nombre
        )
      `)
      .eq("id", dto.turno_original_id)
      .single();

    if (turnoError || !turnoOriginal) {
      throw new NotFoundException("El turno original no existe");
    }

    if (turnoOriginal.estado_turno === "cumplido") {
      throw new BadRequestException("No se puede reemplazar un turno ya cumplido");
    }

    // 2️⃣ Validar empleado de reemplazo
    const { data: empleadoReemplazo, error: empError } = await supabase
      .from("empleados")
      .select("id, nombre_completo, activo")
      .eq("id", dto.empleado_reemplazo_id)
      .single();

    if (empError || !empleadoReemplazo) {
      throw new NotFoundException("Empleado de reemplazo no encontrado");
    }

    if (!empleadoReemplazo.activo) {
      throw new BadRequestException("El empleado de reemplazo no está activo");
    }

    if (turnoOriginal.empleado_id === dto.empleado_reemplazo_id) {
      throw new BadRequestException("El empleado de reemplazo no puede ser el mismo que el original");
    }

    // (ELIMINADO) Validación de que el empleado de reemplazo esté asignado al subpuesto.
    // Esto se quitó para permitir que "turneros" o empleados de descanso hagan reemplazos.


    // 4️⃣ Verificar disponibilidad del empleado de reemplazo
    const { data: turnosConflicto } = await supabase
      .from("turnos")
      .select("id, hora_inicio, hora_fin")
      .eq("empleado_id", dto.empleado_reemplazo_id)
      .eq("fecha", turnoOriginal.fecha)
      .or(`and(hora_inicio.lte.${turnoOriginal.hora_fin},hora_fin.gte.${turnoOriginal.hora_inicio})`);

    if (turnosConflicto && turnosConflicto.length > 0) {
      throw new BadRequestException(
        `El empleado ${empleadoReemplazo.nombre_completo} ya tiene un turno asignado en ese horario`
      );
    }

    // 5️⃣ Crear registro de reemplazo
    const { data: reemplazo, error: errorReemplazo } = await supabase
      .from("turnos_reemplazos")
      .insert({
        turno_original_id: dto.turno_original_id,
        empleado_reemplazo_id: dto.empleado_reemplazo_id,
        motivo: dto.motivo || "Reemplazo de turno",
        autorizado_por: dto.autorizado_por,
        estado: "aprobado",
        fecha_autorizacion: new Date().toISOString(),
      })
      .select()
      .single();

    if (errorReemplazo) {
      this.logger.error(`Error creando reemplazo: ${errorReemplazo.message}`);
      throw new BadRequestException(`Error al crear reemplazo: ${errorReemplazo.message}`);
    }

    const empleadoOriginal = Array.isArray(turnoOriginal.empleado)
      ? turnoOriginal.empleado[0]
      : turnoOriginal.empleado;

    // 6️⃣ Actualizar el turno original - MARCAR como reemplazo, conservar empleado original
    const observationOriginalAuto = `reemplazo realizado turno ${turnoOriginal.tipo_turno} al señor ${empleadoOriginal?.nombre_completo || 'Desconocido'} por motivo de ${dto.motivo} remplazante ${empleadoReemplazo.nombre_completo}`;

    const { data: turnoActualizado, error: errorUpdate } = await supabase
      .from("turnos")
      .update({
        es_reemplazo: true,
        observaciones: turnoOriginal.observaciones ? `${turnoOriginal.observaciones} | ${observationOriginalAuto}` : observationOriginalAuto,
        updated_at: new Date().toISOString(),
      })
      .eq("id", dto.turno_original_id)
      .select()
      .single();

    if (errorUpdate) {
      // Revertir el reemplazo si falla la actualización
      await supabase.from("turnos_reemplazos").delete().eq("id", reemplazo.id);
      throw new BadRequestException(`Error al actualizar turno: ${errorUpdate.message}`);
    }

    // 7️⃣ CREAR NUEVO TURNO para el empleado de REEMPLAZO
    const { data: turnoNuevo, error: errorInsert } = await supabase
      .from("turnos")
      .insert({
        puesto_id: turnoOriginal.puesto_id,
        subpuesto_id: turnoOriginal.subpuesto_id,
        empleado_id: dto.empleado_reemplazo_id,
        fecha: turnoOriginal.fecha,
        hora_inicio: turnoOriginal.hora_inicio,
        hora_fin: turnoOriginal.hora_fin,
        tipo_turno: turnoOriginal.tipo_turno,
        estado_turno: turnoOriginal.estado_turno,
        observaciones: `Cubre reemplazo turno ${turnoOriginal.tipo_turno} de ${empleadoOriginal?.nombre_completo || 'Desconocido'} por motivo: ${dto.motivo}`,
        // no es_reemplazo flag here, so it renders normally with its Shift Code
      })
      .select()
      .single();

    if (errorInsert) {
      this.logger.error(`Error creando turno para reemplazante: ${errorInsert.message}`);
      // Consider reverting updateUpdate and reemplazo here, but for now we throw
      throw new BadRequestException(`Error al asignar turno al reemplazante: ${errorInsert.message}`);
    }

    this.logger.log(
      `✅ Reemplazo exitoso: ${empleadoOriginal?.nombre_completo} → ${empleadoReemplazo.nombre_completo}`
    );

    return {
      mensaje: "✅ Reemplazo creado exitosamente",
      reemplazo,
      turno_actualizado: turnoActualizado,
      turno_nuevo: turnoNuevo,
      detalles: {
        empleado_original: empleadoOriginal?.nombre_completo,
        empleado_reemplazo: empleadoReemplazo.nombre_completo,
        fecha: turnoOriginal.fecha,
        horario: `${turnoOriginal.hora_inicio} - ${turnoOriginal.hora_fin}`,
      }
    };
  }

  /**
   * 📅 Crear reemplazos por rango de fechas (Bulk)
   * Útil para Vacaciones, Incapacidades largas, etc.
   */
  async createRange(dto: CreateTurnoReemplazoRangoDto) {
    const supabase = this.supabaseService.getClient();
    this.logger.log(`📅 Iniciando reemplazo masivo por rango: ${dto.fecha_inicio} a ${dto.fecha_fin}`);

    // 1️⃣ Obtener todos los turnos del empleado original en el rango
    const { data: turnosOriginales, error: errorTurnos } = await supabase
      .from("turnos")
      .select("*")
      .eq("empleado_id", dto.empleado_original_id)
      .gte("fecha", dto.fecha_inicio)
      .lte("fecha", dto.fecha_fin)
      .neq("estado_turno", "cumplido"); // Solo turnos no cumplidos

    if (errorTurnos) {
      throw new BadRequestException(`Error al buscar turnos: ${errorTurnos.message}`);
    }

    if (!turnosOriginales || turnosOriginales.length === 0) {
      this.logger.warn(`No se encontraron turnos pendientes para el empleado ${dto.empleado_original_id} en el rango.`);
      return { mensaje: "No se encontraron turnos para reemplazar en este rango", procesados: 0 };
    }

    // 2️⃣ Validar empleado de reemplazo
    const { data: empleadoReemplazo } = await supabase
      .from("empleados")
      .select("id, nombre_completo, activo")
      .eq("id", dto.empleado_reemplazo_id)
      .single();

    if (!empleadoReemplazo || !empleadoReemplazo.activo) {
      throw new BadRequestException("El empleado de reemplazo no existe o no está activo");
    }

    const { data: empleadoOriginal } = await supabase
      .from("empleados")
      .select("nombre_completo")
      .eq("id", dto.empleado_original_id)
      .single();

    let exitosos = 0;
    let errores = 0;

    // 3️⃣ Procesar cada turno
    for (const turno of turnosOriginales) {
      try {
        // Verificar conflicto para el reemplazante en este turno específico
        const { data: conflicto } = await supabase
          .from("turnos")
          .select("id")
          .eq("empleado_id", dto.empleado_reemplazo_id)
          .eq("fecha", turno.fecha)
          .or(`and(hora_inicio.lte.${turno.hora_fin},hora_fin.gte.${turno.hora_inicio})`);

        if (conflicto && conflicto.length > 0) {
          this.logger.warn(`Salteando turno ${turno.id} por conflicto de horario para el reemplazante`);
          errores++;
          continue;
        }

        // Crear registro en turnos_reemplazos
        await supabase.from("turnos_reemplazos").insert({
          turno_original_id: turno.id,
          empleado_reemplazo_id: dto.empleado_reemplazo_id,
          motivo: dto.motivo,
          autorizado_por: dto.autorizado_por,
          estado: "aprobado",
          fecha_autorizacion: new Date().toISOString(),
        });

        const observationOriginalAuto = `reemplazo masivo (${dto.motivo}) al señor ${empleadoOriginal?.nombre_completo} por ${empleadoReemplazo.nombre_completo}`;

        // Actualizar turno original
        await supabase.from("turnos")
          .update({
            es_reemplazo: true,
            observaciones: turno.observaciones ? `${turno.observaciones} | ${observationOriginalAuto}` : observationOriginalAuto,
            updated_at: new Date().toISOString(),
          })
          .eq("id", turno.id);

        // Crear nuevo turno para el reemplazante
        await supabase.from("turnos").insert({
          puesto_id: turno.puesto_id,
          subpuesto_id: turno.subpuesto_id,
          empleado_id: dto.empleado_reemplazo_id,
          fecha: turno.fecha,
          hora_inicio: turno.hora_inicio,
          hora_fin: turno.hora_fin,
          tipo_turno: turno.tipo_turno,
          estado_turno: turno.estado_turno,
          observaciones: `Cubre reemplazo masivo (${dto.motivo}) de ${empleadoOriginal?.nombre_completo}`,
        });

        exitosos++;
      } catch (e) {
        this.logger.error(`Error procesando reemplazo para turno ${turno.id}: ${e.message}`);
        errores++;
      }
    }

    return {
      mensaje: `✅ Reemplazo masivo completado`,
      exitosos,
      errores,
      total_encontrados: turnosOriginales.length
    };
  }

  /**
   * 📋 Listar todos los reemplazos
   */
  async findAll() {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from("turnos_reemplazos")
      .select(`
        *,
        empleado_reemplazo:empleado_reemplazo_id (
          id,
          nombre_completo
        ),
        turno_original:turno_original_id (
          id,
          fecha,
          hora_inicio,
          hora_fin,
          tipo_turno,
          empleado:empleado_id (
            id,
            nombre_completo
          )
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      throw new BadRequestException(error.message);
    }

    return data;
  }

  /**
   * 🔍 Buscar un reemplazo por ID
   */
  async findOne(id: number) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from("turnos_reemplazos")
      .select(`
        *,
        empleado_reemplazo:empleado_reemplazo_id (
          id,
          nombre_completo
        ),
        turno_original:turno_original_id (
          id,
          fecha,
          hora_inicio,
          hora_fin,
          tipo_turno,
          empleado:empleado_id (
            id,
            nombre_completo
          ),
          puesto:puesto_id (
            id,
            nombre
          ),
          subpuesto:subpuesto_id (
            id,
            nombre
          )
        )
      `)
      .eq("id", id)
      .single();

    if (error || !data) {
      throw new NotFoundException(`Reemplazo con ID ${id} no encontrado`);
    }

    return data;
  }

  /**
   * ✏️ Actualizar estado de un reemplazo
   */
  async update(id: number, dto: UpdateTurnoReemplazoDto) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from("turnos_reemplazos")
      .update({
        ...dto,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(error.message);
    }

    this.logger.log(`✅ Reemplazo ${id} actualizado`);
    return { mensaje: "✅ Reemplazo actualizado", data };
  }

  /**
   * 🗑️ Cancelar un reemplazo
   * Revierte el turno al empleado original
   */
  async remove(id: number) {
    const supabase = this.supabaseService.getClient();

    // Obtener el reemplazo con el turno
    const { data: reemplazo, error: reemplazoError } = await supabase
      .from("turnos_reemplazos")
      .select(`
        *,
        turno_original:turno_original_id (
          id,
          empleado_id
        )
      `)
      .eq("id", id)
      .single();

    if (reemplazoError || !reemplazo) {
      throw new NotFoundException(`Reemplazo ${id} no encontrado`);
    }

    // Obtener el empleado original del turno antes del reemplazo
    // Necesitamos buscar en el historial o usar otra lógica
    // Por ahora, solo eliminamos el registro de reemplazo

    const { error: deleteError } = await supabase
      .from("turnos_reemplazos")
      .delete()
      .eq("id", id);

    if (deleteError) {
      throw new BadRequestException(deleteError.message);
    }

    this.logger.log(`🗑️ Reemplazo ${id} cancelado`);
    return { mensaje: `🗑️ Reemplazo ${id} cancelado correctamente` };
  }

  /**
   * 🔎 Obtener empleados disponibles para reemplazar un turno
   * Un empleado está disponible si está activo y no tiene un turno asignado
   * en el mismo horario y fecha.
   */
  async getEmpleadosDisponibles(turnoId: number) {
    const supabase = this.supabaseService.getClient();

    // 1️⃣ Obtener el turno original para ver horario
    const { data: turno, error } = await supabase
      .from("turnos")
      .select("fecha, hora_inicio, hora_fin, empleado_id")
      .eq("id", turnoId)
      .single();

    if (error || !turno) {
      throw new NotFoundException("Turno original no encontrado");
    }

    // 2️⃣ Buscar qué empleados TIENEN turno en ese rango para esta fecha
    const { data: turnosConflicto } = await supabase
      .from("turnos")
      .select("empleado_id")
      .eq("fecha", turno.fecha)
      .or(`and(hora_inicio.lte.${turno.hora_fin},hora_fin.gte.${turno.hora_inicio})`);

    const empleadosOcupadosIds = new Set(
      turnosConflicto?.map((t) => t.empleado_id) || []
    );
    // Agregamos también al empleado original, no se va a reemplazar a sí mismo
    empleadosOcupadosIds.add(turno.empleado_id);

    // 3️⃣ Traer todos los empleados activos
    const { data: empleadosActivos } = await supabase
      .from("empleados")
      .select("id, nombre_completo, identificacion, cargo")
      .eq("activo", true);

    if (!empleadosActivos) return [];

    // 4️⃣ Filtrar los disponibles
    const candidatos = empleadosActivos.filter(
      (emp) => !empleadosOcupadosIds.has(emp.id)
    );

    return candidatos;
  }
}
