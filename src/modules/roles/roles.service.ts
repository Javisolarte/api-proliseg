import { Injectable, NotFoundException } from "@nestjs/common"
import { SupabaseService } from "../supabase/supabase.service"
import type { CreateRolDto, UpdateRolDto, AsignarModuloRolDto } from "./dto/rol.dto"

@Injectable()
export class RolesService {
  constructor(private readonly supabaseService: SupabaseService) { }

  async findAll() {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase.from("roles").select("*").order("nivel_jerarquia", { ascending: false })

    if (error) throw error
    return data
  }

  async findOne(id: number) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase.from("roles").select("*").eq("id", id).single()

    if (error || !data) {
      throw new NotFoundException(`Rol con ID ${id} no encontrado`)
    }

    return data
  }

  async create(createRolDto: CreateRolDto) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase.from("roles").insert(createRolDto).select().single()

    if (error) throw error
    return data
  }

  async update(id: number, updateRolDto: UpdateRolDto) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase
      .from("roles")
      .update({
        ...updateRolDto,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()

    if (error || !data) {
      throw new NotFoundException(`Rol con ID ${id} no encontrado`)
    }

    return data
  }

  async remove(id: number) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase
      .from("roles")
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single()

    if (error || !data) {
      throw new NotFoundException(`Rol con ID ${id} no encontrado`)
    }

    return { message: "Rol desactivado exitosamente", data }
  }

  async getModulos(rolId: number) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase
      .from("roles_modulos")
      .select(`
        id,
        modulos(id, nombre, descripcion, categoria)
      `)
      .eq("rol_id", rolId)

    if (error) throw error
    return data?.map((rm) => rm.modulos) || []
  }

  async asignarModulo(rolId: number, asignarModuloRolDto: AsignarModuloRolDto) {
    const supabase = this.supabaseService.getClient()

    // Verificar si ya existe
    const { data: existing } = await supabase
      .from("roles_modulos")
      .select("id")
      .eq("rol_id", rolId)
      .eq("modulo_id", asignarModuloRolDto.modulo_id)
      .single()

    if (existing) {
      return { message: "El módulo ya está asignado a este rol" }
    }

    const { data, error } = await supabase
      .from("roles_modulos")
      .insert({
        rol_id: rolId,
        modulo_id: asignarModuloRolDto.modulo_id,
      })
      .select()
      .single()

    if (error) throw error
    return { message: "Módulo asignado exitosamente", data }
  }

  async removerModulo(rolId: number, moduloId: number) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase
      .from("roles_modulos")
      .delete()
      .eq("rol_id", rolId)
      .eq("modulo_id", moduloId)
      .select()
      .single()

    if (error || !data) {
      throw new NotFoundException("Asignación no encontrada")
    }

    return { message: "Módulo removido del rol exitosamente", data }
  }
}
