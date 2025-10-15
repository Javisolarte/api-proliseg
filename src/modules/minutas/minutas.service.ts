import { Injectable, NotFoundException } from "@nestjs/common"
import type { SupabaseService } from "../supabase/supabase.service"
import type { CreateMinutaDto, UpdateMinutaDto } from "./dto/minuta.dto"

@Injectable()
export class MinutasService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async findAll() {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase
      .from("minutas")
      .select(`
        *,
        turnos(
          id,
          fecha,
          empleados(id, nombre_completo)
        ),
        puestos_trabajo(id, nombre, direccion)
      `)
      .order("created_at", { ascending: false })

    if (error) throw error
    return data
  }

  async findOne(id: number) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase
      .from("minutas")
      .select(`
        *,
        turnos(
          id,
          fecha,
          hora_inicio,
          hora_fin,
          empleados(id, nombre_completo, cedula)
        ),
        puestos_trabajo(id, nombre, direccion, ciudad)
      `)
      .eq("id", id)
      .single()

    if (error || !data) {
      throw new NotFoundException(`Minuta con ID ${id} no encontrada`)
    }

    return data
  }

  async create(createMinutaDto: CreateMinutaDto, creadaPor: number) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase
      .from("minutas")
      .insert({
        ...createMinutaDto,
        creada_por: creadaPor,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async update(id: number, updateMinutaDto: UpdateMinutaDto) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase
      .from("minutas")
      .update({
        ...updateMinutaDto,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()

    if (error || !data) {
      throw new NotFoundException(`Minuta con ID ${id} no encontrada`)
    }

    return data
  }

  async remove(id: number) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase.from("minutas").delete().eq("id", id).select().single()

    if (error || !data) {
      throw new NotFoundException(`Minuta con ID ${id} no encontrada`)
    }

    return { message: "Minuta eliminada exitosamente", data }
  }
}
