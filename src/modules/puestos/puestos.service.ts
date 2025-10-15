import { Injectable, NotFoundException } from "@nestjs/common"
import type { SupabaseService } from "../supabase/supabase.service"
import type { CreatePuestoDto, UpdatePuestoDto } from "./dto/puesto.dto"

@Injectable()
export class PuestosService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async findAll() {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase
      .from("puestos_trabajo")
      .select(`
        *,
        contratos(
          id,
          tipo_contrato,
          clientes(id, nombre_empresa)
        )
      `)
      .order("created_at", { ascending: false })

    if (error) throw error
    return data
  }

  async findOne(id: number) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase
      .from("puestos_trabajo")
      .select(`
        *,
        contratos(
          id,
          tipo_contrato,
          valor,
          fecha_inicio,
          fecha_fin,
          clientes(id, nombre_empresa, nit, contacto, telefono)
        )
      `)
      .eq("id", id)
      .single()

    if (error || !data) {
      throw new NotFoundException(`Puesto con ID ${id} no encontrado`)
    }

    return data
  }

  async create(createPuestoDto: CreatePuestoDto) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase.from("puestos_trabajo").insert(createPuestoDto).select().single()

    if (error) throw error
    return data
  }

  async update(id: number, updatePuestoDto: UpdatePuestoDto) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase
      .from("puestos_trabajo")
      .update(updatePuestoDto)
      .eq("id", id)
      .select()
      .single()

    if (error || !data) {
      throw new NotFoundException(`Puesto con ID ${id} no encontrado`)
    }

    return data
  }

  async remove(id: number) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase
      .from("puestos_trabajo")
      .update({ activo: false })
      .eq("id", id)
      .select()
      .single()

    if (error || !data) {
      throw new NotFoundException(`Puesto con ID ${id} no encontrado`)
    }

    return { message: "Puesto eliminado exitosamente", data }
  }
}
