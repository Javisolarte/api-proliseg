import { Injectable, BadRequestException, NotFoundException, Logger } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import type { CreateSubpuestoDto, UpdateSubpuestoDto } from "./dto/subpuesto.dto";

import { AsignarTurnosService } from '../asignar_turnos/asignar_turnos.service';

@Injectable()
export class SubpuestosService {
  private readonly logger = new Logger(SubpuestosService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly asignarTurnosService: AsignarTurnosService
  ) { }

  // 🔹 Listar todos los subpuestos
  async findAll() {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from("subpuestos_trabajo")
      .select(`
        *,
        puesto:puesto_id (
          id,
          nombre,
          contrato_id,
          direccion,
          ciudad
        ),
        configuracion:configuracion_id (
          id,
          nombre,
          dias_ciclo,
          activo
        )
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  }

  // 🔹 Obtener un subpuesto por ID
  async findOne(id: number) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from("subpuestos_trabajo")
      .select(`
        *,
        puesto:puesto_id (
          id,
          nombre,
          contrato_id,
          direccion,
          ciudad
        ),
        configuracion:configuracion_id (
          id,
          nombre,
          dias_ciclo,
          activo
        )
      `)
      .eq("id", id)
      .single();

    if (error || !data) throw new NotFoundException("Subpuesto no encontrado");
    return data;
  }

  // 🔹 Crear un nuevo subpuesto
  async create(dto: CreateSubpuestoDto, userId: number) {
    const supabase = this.supabaseService.getClient();

    // 1️⃣ Verificar que el puesto padre exista
    const { data: puesto, error: puestoError } = await supabase
      .from("puestos_trabajo")
      .select("id, contrato_id")
      .eq("id", dto.parent_id)
      .single();

    if (puestoError || !puesto)
      throw new NotFoundException("Puesto padre no encontrado");

    // 2️⃣ Verificar que la configuración de turnos exista y esté activa
    const { data: configuracion, error: configError } = await supabase
      .from("turnos_configuracion")
      .select("id, nombre, activo")
      .eq("id", dto.configuracion_id)
      .single();

    if (configError || !configuracion)
      throw new NotFoundException("Configuración de turnos no encontrada");

    if (!configuracion.activo)
      throw new BadRequestException("La configuración de turnos no está activa");

    // 3️⃣ Validar que la suma de guardas_activos no exceda el contrato
    const { data: contrato } = await supabase
      .from("contratos")
      .select("guardas_activos")
      .eq("id", puesto.contrato_id)
      .single();

    if (!contrato) {
      throw new NotFoundException("Contrato no encontrado");
    }

    // Obtener suma actual de guardas_activos de subpuestos del mismo puesto
    const { data: subpuestosExistentes } = await supabase
      .from("subpuestos_trabajo")
      .select("guardas_activos")
      .eq("puesto_id", dto.parent_id)
      .eq("activo", true);

    const sumaActual = (subpuestosExistentes || []).reduce(
      (sum, s) => sum + (s.guardas_activos || 0),
      0
    );

    const nuevaSuma = sumaActual + dto.guardas_activos;

    if (nuevaSuma > contrato.guardas_activos) {
      throw new BadRequestException(
        `La suma de guardas activos (${nuevaSuma}) excede el límite del contrato (${contrato.guardas_activos}). ` +
        `Actualmente asignados: ${sumaActual}, intentando agregar: ${dto.guardas_activos}`
      );
    }

    this.logger.log(
      `✅ Validación de contrato: ${nuevaSuma}/${contrato.guardas_activos} guardas activos`
    );

    // 4️⃣ Crear subpuesto con los nuevos campos
    const { data, error } = await supabase
      .from("subpuestos_trabajo")
      .insert({
        puesto_id: dto.parent_id,
        nombre: dto.nombre,
        descripcion: dto.descripcion || null,
        guardas_activos: dto.guardas_activos,
        configuracion_id: dto.configuracion_id,
        activo: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return { message: "Subpuesto creado exitosamente", data };
  }

  // 🔹 Actualizar subpuesto existente
  async update(id: number, dto: UpdateSubpuestoDto, userId: number) {
    const supabase = this.supabaseService.getClient();

    const { data: existing, error: findError } = await supabase
      .from("subpuestos_trabajo")
      .select("id, configuracion_id, puesto_id, guardas_activos")
      .eq("id", id)
      .single();

    if (findError || !existing)
      throw new NotFoundException("Subpuesto no encontrado");

    // Si se está actualizando la configuración, verificar que exista y esté activa
    if (dto.configuracion_id && dto.configuracion_id !== existing.configuracion_id) {
      const { data: configuracion, error: configError } = await supabase
        .from("turnos_configuracion")
        .select("id, activo")
        .eq("id", dto.configuracion_id)
        .single();

      if (configError || !configuracion)
        throw new NotFoundException("Configuración de turnos no encontrada");

      if (!configuracion.activo)
        throw new BadRequestException("La configuración de turnos no está activa");
    }

    // ✅ Validar suma de guardas_activos si se está actualizando
    if (dto.guardas_activos !== undefined && dto.guardas_activos !== existing.guardas_activos) {
      const { data: puesto } = await supabase
        .from("puestos_trabajo")
        .select("contrato_id")
        .eq("id", existing.puesto_id)
        .single();

      if (!puesto) {
        throw new NotFoundException("Puesto no encontrado");
      }

      const { data: contrato } = await supabase
        .from("contratos")
        .select("guardas_activos")
        .eq("id", puesto.contrato_id)
        .single();

      if (!contrato) {
        throw new NotFoundException("Contrato no encontrado");
      }

      // Obtener suma de otros subpuestos (excluyendo el actual)
      const { data: otrosSubpuestos } = await supabase
        .from("subpuestos_trabajo")
        .select("guardas_activos")
        .eq("puesto_id", existing.puesto_id)
        .eq("activo", true)
        .neq("id", id);

      const sumaOtros = (otrosSubpuestos || []).reduce(
        (sum, s) => sum + (s.guardas_activos || 0),
        0
      );

      const nuevaSuma = sumaOtros + dto.guardas_activos;

      if (nuevaSuma > contrato.guardas_activos) {
        throw new BadRequestException(
          `La suma de guardas activos (${nuevaSuma}) excede el límite del contrato (${contrato.guardas_activos}). ` +
          `Actualmente asignados en otros subpuestos: ${sumaOtros}, intentando actualizar a: ${dto.guardas_activos}`
        );
      }

      this.logger.log(
        `✅ Validación de contrato en UPDATE: ${nuevaSuma}/${contrato.guardas_activos} guardas activos`
      );
    }

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (dto.nombre !== undefined) updateData.nombre = dto.nombre;
    if (dto.descripcion !== undefined) updateData.descripcion = dto.descripcion;
    if (dto.guardas_activos !== undefined) updateData.guardas_activos = dto.guardas_activos;
    if (dto.configuracion_id !== undefined) updateData.configuracion_id = dto.configuracion_id;
    if (dto.activo !== undefined) updateData.activo = dto.activo;

    const { data: updatedSubpuesto, error } = await supabase
      .from("subpuestos_trabajo")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    // ✅ Hook: Si cambió la configuración, regenerar turnos futuros automáticamente
    if (dto.configuracion_id !== undefined && dto.configuracion_id !== existing.configuracion_id) {
      this.logger.log(`🔄 Cambio de configuración detectado en subpuesto ${id}. Regenerando turnos...`);
      // Ejecutar en segundo plano para no bloquear respuesta
      this.asignarTurnosService.regenerarTurnos(id, userId)
        .then(res => this.logger.log(`✅ Turnos regenerados post-update: ${res.message}`))
        .catch(err => this.logger.error(`❌ Error regenerando turnos post-update: ${err.message}`));
    }

    return { message: "Subpuesto actualizado exitosamente", data: updatedSubpuesto };
  }

  // 🔹 Soft delete (eliminar lógicamente)
  async softDelete(id: number, userId: number) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from("subpuestos_trabajo")
      .update({
        activo: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return { message: "Subpuesto eliminado (soft delete) exitosamente", data };
  }

  /**
   * 🔹 Obtener guardas necesarios de un subpuesto desde la vista
   * Usa la vista vw_guardas_necesarios_subpuesto que calcula automáticamente
   * los guardas necesarios basados en guardas_activos y estados del ciclo
   */
  async getGuardasNecesarios(subpuestoId: number) {
    const supabase = this.supabaseService.getClient();

    // Consultar la vista de guardas necesarios
    const { data: vistaData, error: vistaError } = await supabase
      .from("vw_guardas_necesarios_subpuesto")
      .select("*")
      .eq("subpuesto_id", subpuestoId)
      .maybeSingle(); // Cambiado de .single() a .maybeSingle()

    if (vistaError) {
      throw new NotFoundException(
        `Error al obtener información de guardas necesarios: ${vistaError.message}`
      );
    }

    if (!vistaData) {
      throw new NotFoundException(
        `No se pudo obtener información de guardas necesarios para el subpuesto ${subpuestoId}. Verifique que el subpuesto tenga configuración de turnos activa.`
      );
    }

    // Obtener empleados asignados al subpuesto
    const { data: asignaciones, error: asignError } = await supabase
      .from("asignacion_guardas_puesto")
      .select("empleado_id")
      .eq("subpuesto_id", subpuestoId)
      .eq("activo", true);

    if (asignError) {
      console.warn(`Error al obtener asignaciones: ${asignError.message}`);
    }

    const empleadosAsignados = asignaciones?.length || 0;
    const cuposDisponibles = (vistaData.guardas_necesarios || 0) - empleadosAsignados;

    return {
      ...vistaData,
      empleados_asignados: empleadosAsignados,
      cupos_disponibles: cuposDisponibles,
    };
  }

  /**
   * 🔹 Obtener empleados activos asignados a un subpuesto
   */
  async getEmpleadosActivos(subpuestoId: number) {
    const supabase = this.supabaseService.getClient();

    // Verificar que el subpuesto exista
    await this.findOne(subpuestoId);

    const { data, error } = await supabase
      .from("asignacion_guardas_puesto")
      .select(`
        id,
        fecha_asignacion,
        observaciones,
        empleado:empleado_id (
          id,
          nombre_completo,
          cedula,
          telefono,
          correo
        )
      `)
      .eq("subpuesto_id", subpuestoId)
      .eq("activo", true)
      .order("fecha_asignacion", { ascending: false });

    if (error) throw error;

    return {
      subpuesto_id: subpuestoId,
      total_empleados: data?.length || 0,
      empleados: data || [],
    };
  }
}
