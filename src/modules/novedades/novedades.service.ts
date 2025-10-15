import { Injectable, NotFoundException } from "@nestjs/common"
import type { SupabaseService } from "../supabase/supabase.service"
import type { CreateNovedadDto, UpdateNovedadDto } from "./dto/novedad.dto"

@Injectable()
export class NovedadesService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async findAll() {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase
      .from("novedades")
      .select(`
        *,
        turnos(
          id,
          fecha,
          empleados(id, nombre_completo),
          puestos_trabajo(id, nombre)
        )
      `)
      .order("created_at", { ascending: false })

    if (error) throw error
    return data
  }

  async findOne(id: number) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase
      .from("novedades")
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
      .eq("id", id)
      .single()

    if (error || !data) {
      throw new NotFoundException(`Novedad con ID ${id} no encontrada`)
    }

    return data
  }

  async create(createNovedadDto: CreateNovedadDto, creadaPor: number) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase
      .from("novedades")
      .insert({
        ...createNovedadDto,
        creada_por: creadaPor,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async update(id: number, updateNovedadDto: UpdateNovedadDto) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase
      .from("novedades")
      .update({
        ...updateNovedadDto,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()

    if (error || !data) {
      throw new NotFoundException(`Novedad con ID ${id} no encontrada`)
    }

    return data
  }

  async remove(id: number) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase.from("novedades").delete().eq("id", id).select().single()

    if (error || !data) {
      throw new NotFoundException(`Novedad con ID ${id} no encontrada`)
    }

    return { message: "Novedad eliminada exitosamente", data }
  }
}
