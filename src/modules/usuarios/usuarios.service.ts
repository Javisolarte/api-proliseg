import { Injectable, NotFoundException } from "@nestjs/common"
import  { SupabaseService } from "../supabase/supabase.service"
import type { UpdateUsuarioDto, AsignarModuloDto } from "./dto/usuario.dto"

@Injectable()
export class UsuariosService {
  constructor(private readonly supabaseService: SupabaseService) {
     console.log('Construyendo UsuariosService');
     console.log('Dependencia inyectada:', supabaseService);
  }

  async findAll() {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase
      .from("usuarios_externos")
      .select(`
        *,
        roles(id, nombre, descripcion, nivel_jerarquia)
      `)
      .order("created_at", { ascending: false })

    if (error) throw error
    return data
  }

  async findOne(id: number) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase
      .from("usuarios_externos")
      .select(`
        *,
        roles(id, nombre, descripcion, nivel_jerarquia)
      `)
      .eq("id", id)
      .single()

    if (error || !data) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`)
    }

    return data
  }

  async update(id: number, updateUsuarioDto: UpdateUsuarioDto) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase
      .from("usuarios_externos")
      .update({
        ...updateUsuarioDto,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()

    if (error || !data) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`)
    }

    return data
  }

  async remove(id: number) {
    const supabase = this.supabaseService.getClient()
    const { data, error } = await supabase
      .from("usuarios_externos")
      .update({ estado: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single()

    if (error || !data) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`)
    }

    return { message: "Usuario desactivado exitosamente", data }
  }

  async getPermisos(usuarioId: number) {
    const supabase = this.supabaseService.getClient()

    // Obtener usuario con su rol
    const { data: usuario } = await supabase.from("usuarios_externos").select("id, rol").eq("id", usuarioId).single()

    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${usuarioId} no encontrado`)
    }

    // Obtener módulos del rol
    const { data: rolesModulos } = await supabase
      .from("roles_modulos")
      .select("modulo_id, modulos(*)")
      .eq("rol_id", usuario.rol)

    // Obtener módulos específicos del usuario
    const { data: usuariosModulos } = await supabase
      .from("usuarios_modulos")
      .select("modulo_id, modulos(*), concedido")
      .eq("usuario_id", usuarioId)

    return {
      modulos_rol: rolesModulos?.map((rm) => rm.modulos) || [],
      modulos_usuario: usuariosModulos || [],
    }
  }

  async asignarModulo(usuarioId: number, asignarModuloDto: AsignarModuloDto) {
    const supabase = this.supabaseService.getClient()

    // Verificar si ya existe la asignación
    const { data: existing } = await supabase
      .from("usuarios_modulos")
      .select("id")
      .eq("usuario_id", usuarioId)
      .eq("modulo_id", asignarModuloDto.modulo_id)
      .single()

    if (existing) {
      // Actualizar
      const { data, error } = await supabase
        .from("usuarios_modulos")
        .update({ concedido: asignarModuloDto.concedido })
        .eq("id", existing.id)
        .select()
        .single()

      if (error) throw error
      return data
    } else {
      // Crear nuevo
      const { data, error } = await supabase
        .from("usuarios_modulos")
        .insert({
          usuario_id: usuarioId,
          modulo_id: asignarModuloDto.modulo_id,
          concedido: asignarModuloDto.concedido,
        })
        .select()
        .single()

      if (error) throw error
      return data
    }
  }
}
