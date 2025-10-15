import { Injectable, NotFoundException } from "@nestjs/common"
import  { SupabaseService } from "../supabase/supabase.service"
import type { CreateClienteDto, UpdateClienteDto } from "./dto/cliente.dto"

@Injectable()
export class ClientesService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async findAll() {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase.from("clientes").select("*").order("created_at", { ascending: false })

    if (error) throw error
    return data
  }

  async findOne(id: number) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase.from("clientes").select("*").eq("id", id).single()

    if (error || !data) {
      throw new NotFoundException(`Cliente con ID ${id} no encontrado`)
    }

    return data
  }

  async create(createClienteDto: CreateClienteDto) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase.from("clientes").insert(createClienteDto).select().single()

    if (error) throw error
    return data
  }

  async update(id: number, updateClienteDto: UpdateClienteDto) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase.from("clientes").update(updateClienteDto).eq("id", id).select().single()

    if (error || !data) {
      throw new NotFoundException(`Cliente con ID ${id} no encontrado`)
    }

    return data
  }

  async remove(id: number) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase.from("clientes").update({ activo: false }).eq("id", id).select().single()

    if (error || !data) {
      throw new NotFoundException(`Cliente con ID ${id} no encontrado`)
    }

    return { message: "Cliente eliminado exitosamente", data }
  }

  async getContratos(clienteId: number) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase
      .from("contratos")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false })

    if (error) throw error
    return data
  }
}
