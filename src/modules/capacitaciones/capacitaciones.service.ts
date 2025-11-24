import { Injectable, NotFoundException } from "@nestjs/common"
import { SupabaseService } from "../supabase/supabase.service"
import type { CreateCapacitacionDto, UpdateCapacitacionDto } from "./dto/capacitacion.dto"

@Injectable()
export class CapacitacionesService {
  constructor(private readonly supabaseService: SupabaseService) { }

  async findAll() {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase.from("capacitaciones").select("*").order("created_at", { ascending: false })

    if (error) throw error
    return data
  }

  async findOne(id: number) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase.from("capacitaciones").select("*").eq("id", id).single()

    if (error || !data) {
      throw new NotFoundException(`Capacitación con ID ${id} no encontrada`)
    }

    return data
  }

  async create(createCapacitacionDto: CreateCapacitacionDto) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase.from("capacitaciones").insert(createCapacitacionDto).select().single()

    if (error) throw error
    return data
  }

  async update(id: number, updateCapacitacionDto: UpdateCapacitacionDto) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase
      .from("capacitaciones")
      .update({
        ...updateCapacitacionDto,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()

    if (error || !data) {
      throw new NotFoundException(`Capacitación con ID ${id} no encontrada`)
    }

    return data
  }

  async remove(id: number) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase
      .from("capacitaciones")
      .update({ activa: false })
      .eq("id", id)
      .select()
      .single()

    if (error || !data) {
      throw new NotFoundException(`Capacitación con ID ${id} no encontrada`)
    }

    return { message: "Capacitación eliminada exitosamente", data }
  }

  // 🔹 Asignar capacitación a empleado
  async asignarCapacitacion(asignacion: any) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase
      .from("empleado_capacitaciones")
      .insert(asignacion)
      .select()
      .single()

    if (error) throw error
    return data
  }

  // 🔹 Obtener asignaciones
  async getAsignaciones(empleadoId?: number) {
    const supabase = this.supabaseService.getClient()
    let query = supabase
      .from("empleado_capacitaciones")
      .select(`
        *,
        capacitaciones(nombre, descripcion),
        empleados(nombre_completo, cedula)
      `)

    if (empleadoId) {
      query = query.eq("empleado_id", empleadoId)
    }

    const { data, error } = await query.order("fecha_realizacion", { ascending: false })

    if (error) throw error
    return data
  }
}
