import { Injectable, NotFoundException } from "@nestjs/common"
import { SupabaseService } from "../supabase/supabase.service"
import type { CreateContratoDto, UpdateContratoDto } from "./dto/contrato.dto"

@Injectable()
export class ContratosService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async findAll() {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase
      .from("contratos")
      .select(`
        *,
        clientes(id, nombre_empresa, nit, contacto)
      `)
      .order("created_at", { ascending: false })

    if (error) throw error
    return data
  }

  async findOne(id: number) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase
      .from("contratos")
      .select(`
        *,
        clientes(id, nombre_empresa, nit, direccion, telefono, contacto)
      `)
      .eq("id", id)
      .single()

    if (error || !data) {
      throw new NotFoundException(`Contrato con ID ${id} no encontrado`)
    }

    return data
  }

  async create(createContratoDto: CreateContratoDto) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase.from("contratos").insert(createContratoDto).select().single()

    if (error) throw error
    return data
  }

  async update(id: number, updateContratoDto: UpdateContratoDto) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase.from("contratos").update(updateContratoDto).eq("id", id).select().single()

    if (error || !data) {
      throw new NotFoundException(`Contrato con ID ${id} no encontrado`)
    }

    return data
  }

  async remove(id: number) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase.from("contratos").update({ estado: false }).eq("id", id).select().single()

    if (error || !data) {
      throw new NotFoundException(`Contrato con ID ${id} no encontrado`)
    }

    return { message: "Contrato eliminado exitosamente", data }
  }

  async getPuestos(contratoId: number) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase
      .from("puestos_trabajo")
      .select("*")
      .eq("contrato_id", contratoId)
      .order("created_at", { ascending: false })

    if (error) throw error
    return data
  }
}
