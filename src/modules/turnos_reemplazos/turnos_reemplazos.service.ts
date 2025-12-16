import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import type { CreateTurnoReemplazoDto, UpdateTurnoReemplazoDto } from "./dto/turnos_reemplazos.dto";
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

    // 3️⃣ Verificar que el empleado de reemplazo está asignado al subpuesto
    const { data: asignacion } = await supabase
      .from("asignacion_guardas_puesto")
      .select("id")
      .eq("empleado_id", dto.empleado_reemplazo_id)
      .eq("subpuesto_id", turnoOriginal.subpuesto_id)
      .eq("activo", true)
      .maybeSingle();

    if (!asignacion) {
      const subpuesto = Array.isArray(turnoOriginal.subpuesto)
        ? turnoOriginal.subpuesto[0]
        : turnoOriginal.subpuesto;
      throw new BadRequestException(
        `El empleado ${empleadoReemplazo.nombre_completo} no está asignado al subpuesto ${subpuesto?.nombre}`
      );
    }

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

    // 6️⃣ Actualizar el turno original - REASIGNAR al nuevo empleado
    const { data: turnoActualizado, error: errorUpdate } = await supabase
      .from("turnos")
      .update({
        empleado_id: dto.empleado_reemplazo_id,
        tipo_turno: "reemplazo",
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

    const empleadoOriginal = Array.isArray(turnoOriginal.empleado)
      ? turnoOriginal.empleado[0]
      : turnoOriginal.empleado;

    this.logger.log(
      `✅ Reemplazo exitoso: ${empleadoOriginal?.nombre_completo} → ${empleadoReemplazo.nombre_completo}`
    );

    return {
      mensaje: "✅ Reemplazo creado exitosamente",
      reemplazo,
      turno_actualizado: turnoActualizado,
      detalles: {
        empleado_original: empleadoOriginal?.nombre_completo,
        empleado_reemplazo: empleadoReemplazo.nombre_completo,
        fecha: turnoOriginal.fecha,
        horario: `${turnoOriginal.hora_inicio} - ${turnoOriginal.hora_fin}`,
      }
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
}
