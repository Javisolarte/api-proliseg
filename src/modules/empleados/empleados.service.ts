import { Injectable, NotFoundException } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import type { CreateEmpleadoDto, UpdateEmpleadoDto } from "./dto/empleado.dto";

@Injectable()
export class EmpleadosService {
  constructor(private readonly supabaseService: SupabaseService) {}

  // 🔹 Obtener todos los empleados desde la vista
  async findAll(filters?: { activo?: boolean; tipoEmpleadoId?: number }) {
    const supabase = this.supabaseService.getClient();
    let query = supabase
      .from("vista_empleados") // ✅ usamos la vista
      .select("*")
      .order("created_at", { ascending: false });

    if (filters?.activo !== undefined) {
      query = query.eq("activo", filters.activo);
    }

    if (filters?.tipoEmpleadoId) {
      query = query.eq("tipo_empleado_id", filters.tipoEmpleadoId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return data;
  }

  // 🔹 Obtener un empleado por ID (desde la vista)
  async findOne(id: number) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from("vista_empleados") // ✅ usamos la vista
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      throw new NotFoundException(`Empleado con ID ${id} no encontrado`);
    }

    return data;
  }

  // 🔹 Crear un nuevo empleado (tabla base empleados)
  async create(createEmpleadoDto: CreateEmpleadoDto, userId: number) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from("empleados") // 👈 se sigue insertando en la tabla base
      .insert({
        ...createEmpleadoDto,
        creado_por: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // 🔹 Actualizar empleado existente
  async update(id: number, updateEmpleadoDto: UpdateEmpleadoDto, userId: number) {
    const supabase = this.supabaseService.getClient();

    // Verificar existencia
    const { data: existing, error: findError } = await supabase
      .from("empleados")
      .select("id")
      .eq("id", id)
      .single();

    if (findError || !existing) {
      throw new NotFoundException(`Empleado con ID ${id} no encontrado`);
    }

    // Actualizar
    const { data, error } = await supabase
      .from("empleados")
      .update({
        ...updateEmpleadoDto,
        actualizado_por: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // 🔹 Soft delete (cambio de estado sin eliminar)
  async softDelete(id: number, userId: number) {
    const supabase = this.supabaseService.getClient();

    const { data: existing, error: findError } = await supabase
      .from("empleados")
      .select("id, activo")
      .eq("id", id)
      .single();

    if (findError || !existing) {
      throw new NotFoundException(`Empleado con ID ${id} no encontrado`);
    }

    const { data, error } = await supabase
      .from("empleados")
      .update({
        activo: false,
        fecha_salida: new Date().toISOString(),
        actualizado_por: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return { message: "Empleado eliminado (soft delete) exitosamente", data };
  }

  // 🔹 Consultar capacitaciones de un empleado
  async getCapacitaciones(empleadoId: number) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from("empleado_capacitaciones")
      .select(`
        *,
        capacitaciones(id, nombre, descripcion, duracion_horas, obligatoria)
      `)
      .eq("empleado_id", empleadoId)
      .order("fecha_realizacion", { ascending: false });

    if (error) throw error;
    return data;
  }
}
