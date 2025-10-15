import { Injectable, NotFoundException } from "@nestjs/common"
import { SupabaseService } from "../supabase/supabase.service"
import type { CreateAsistenciaDto } from "./dto/asistencia.dto"

@Injectable()
export class AsistenciasService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async findAll(filters?: { turnoId?: number; fechaInicio?: string; fechaFin?: string }) {
    const supabase = this.supabaseService.getClient()
    let query = supabase
      .from("asistencias")
      .select(`
        *,
        turnos(
          id,
          fecha,
          hora_inicio,
          hora_fin,
          empleados(id, nombre_completo, cedula),
          puestos_trabajo(id, nombre, direccion)
        )
      `)
      .order("timestamp", { ascending: false })

    if (filters?.turnoId) {
      query = query.eq("turno_id", filters.turnoId)
    }

    if (filters?.fechaInicio) {
      query = query.gte("timestamp", filters.fechaInicio)
    }

    if (filters?.fechaFin) {
      query = query.lte("timestamp", filters.fechaFin)
    }

    const { data, error } = await query

    if (error) throw error
    return data
  }

  async findOne(id: number) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase
      .from("asistencias")
      .select(`
        *,
        turnos(
          id,
          fecha,
          hora_inicio,
          hora_fin,
          empleados(id, nombre_completo, cedula),
          puestos_trabajo(id, nombre, direccion, ciudad)
        )
      `)
      .eq("id", id)
      .single()

    if (error || !data) {
      throw new NotFoundException(`Asistencia con ID ${id} no encontrada`)
    }

    return data
  }

  async create(createAsistenciaDto: CreateAsistenciaDto, registradaPor: number) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase
      .from("asistencias")
      .insert({
        ...createAsistenciaDto,
        registrada_por: registradaPor,
        timestamp: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error
    return data
  }
}
