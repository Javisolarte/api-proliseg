import { Injectable, NotFoundException } from "@nestjs/common"
import { SupabaseService } from "../supabase/supabase.service"
import type { CreateTurnoDto, UpdateTurnoDto } from "./dto/turno.dto"

@Injectable()
export class TurnosService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async findAll(filters?: { fecha?: string; empleadoId?: number; puestoId?: number }) {
    const supabase = this.supabaseService.getClient()
    let query = supabase
      .from("turnos")
      .select(`
        *,
        empleados(id, nombre_completo, cedula),
        puestos_trabajo(id, nombre, direccion, ciudad)
      `)
      .order("fecha", { ascending: false })

    if (filters?.fecha) {
      query = query.eq("fecha", filters.fecha)
    }

    if (filters?.empleadoId) {
      query = query.eq("empleado_id", filters.empleadoId)
    }

    if (filters?.puestoId) {
      query = query.eq("puesto_id", filters.puestoId)
    }

    const { data, error } = await query

    if (error) throw error
    return data
  }

  async findOne(id: number) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase
      .from("turnos")
      .select(`
        *,
        empleados(id, nombre_completo, cedula, telefono),
        puestos_trabajo(id, nombre, direccion, ciudad, latitud, longitud)
      `)
      .eq("id", id)
      .single()

    if (error || !data) {
      throw new NotFoundException(`Turno con ID ${id} no encontrado`)
    }

    return data
  }

  async create(createTurnoDto: CreateTurnoDto, asignadoPor: number) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase
      .from("turnos")
      .insert({
        ...createTurnoDto,
        asignado_por: asignadoPor,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async update(id: number, updateTurnoDto: UpdateTurnoDto) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase.from("turnos").update(updateTurnoDto).eq("id", id).select().single()

    if (error || !data) {
      throw new NotFoundException(`Turno con ID ${id} no encontrado`)
    }

    return data
  }

  async remove(id: number) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase.from("turnos").delete().eq("id", id).select().single()

    if (error || !data) {
      throw new NotFoundException(`Turno con ID ${id} no encontrado`)
    }

    return { message: "Turno eliminado exitosamente", data }
  }
}
