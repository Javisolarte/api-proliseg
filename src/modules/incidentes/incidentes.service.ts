import { Injectable, NotFoundException } from "@nestjs/common"
import type { SupabaseService } from "../supabase/supabase.service"
import type { CreateIncidenteDto, UpdateIncidenteDto } from "./dto/incidente.dto"

@Injectable()
export class IncidentesService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async findAll(filters?: { estado?: string; nivelGravedad?: string }) {
    const supabase = this.supabaseService.getClient()
    let query = supabase
      .from("incidentes")
      .select(`
        *,
        puestos_trabajo(id, nombre, direccion),
        empleados(id, nombre_completo, cedula)
      `)
      .order("fecha_incidente", { ascending: false })

    if (filters?.estado) {
      query = query.eq("estado", filters.estado)
    }

    if (filters?.nivelGravedad) {
      query = query.eq("nivel_gravedad", filters.nivelGravedad)
    }

    const { data, error } = await query

    if (error) throw error
    return data
  }

  async findOne(id: number) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase
      .from("incidentes")
      .select(`
        *,
        puestos_trabajo(id, nombre, direccion, ciudad),
        empleados(id, nombre_completo, cedula, telefono)
      `)
      .eq("id", id)
      .single()

    if (error || !data) {
      throw new NotFoundException(`Incidente con ID ${id} no encontrado`)
    }

    return data
  }

  async create(createIncidenteDto: CreateIncidenteDto, empleadoReporta: number) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase
      .from("incidentes")
      .insert({
        ...createIncidenteDto,
        empleado_reporta: empleadoReporta,
        fecha_reporte: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async update(id: number, updateIncidenteDto: UpdateIncidenteDto, resueltoPor?: number) {
    const supabase = this.supabaseService.getClient()

    const updateData: any = {
      ...updateIncidenteDto,
      updated_at: new Date().toISOString(),
    }

    if (updateIncidenteDto.estado === "resuelto" || updateIncidenteDto.estado === "cerrado") {
      updateData.resuelto_por = resueltoPor
      updateData.fecha_resolucion = new Date().toISOString()
    }

    const { data, error } = await supabase.from("incidentes").update(updateData).eq("id", id).select().single()

    if (error || !data) {
      throw new NotFoundException(`Incidente con ID ${id} no encontrado`)
    }

    return data
  }
}
