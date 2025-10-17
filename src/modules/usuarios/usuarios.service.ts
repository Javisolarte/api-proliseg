import { Injectable, NotFoundException } from "@nestjs/common"
import { SupabaseService } from "../supabase/supabase.service"
import type { UpdateUsuarioDto, AsignarModuloDto } from "./dto/usuario.dto"

@Injectable()
export class UsuariosService {
  constructor(private readonly supabaseService: SupabaseService) {
    console.log("🧩 Construyendo UsuariosService")
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

  /**
   * 🧩 Obtener permisos (módulos) de un usuario según:
   * - los módulos asignados a su rol
   * - los módulos individuales asignados al usuario
   */
  async getPermisos(usuarioId: number) {
    const supabase = this.supabaseService.getClient()

    // 1️⃣ Obtener usuario con su rol
    const { data: usuario, error: userError } = await supabase
      .from("usuarios_externos")
      .select("id, rol")
      .eq("id", usuarioId)
      .single()

    if (userError || !usuario) {
      throw new NotFoundException(`Usuario con ID ${usuarioId} no encontrado`)
    }

    // 2️⃣ Obtener módulos del rol
    const { data: rolesModulos, error: rolError } = await supabase
      .from("roles_modulos")
      .select("modulo_id, modulos(*)")
      .eq("rol_id", usuario.rol)

    if (rolError) throw rolError

    // 3️⃣ Obtener módulos específicos del usuario
    const { data: usuariosModulos, error: userModError } = await supabase
      .from("usuarios_modulos")
      .select("modulo_id, concedido, modulos(*)")
      .eq("usuario_id", usuarioId)

    if (userModError) throw userModError

    // 4️⃣ Combinar y eliminar duplicados
    const modulosMap = new Map<number, any>()

    rolesModulos?.forEach((rm) => {
      const modulo = Array.isArray(rm.modulos) ? rm.modulos[0] : rm.modulos
      if (modulo && modulo.id) modulosMap.set(modulo.id, modulo)
    })

    usuariosModulos?.forEach((um) => {
      const modulo = Array.isArray(um.modulos) ? um.modulos[0] : um.modulos
      if (modulo && modulo.id) modulosMap.set(modulo.id, modulo)
    })

    const todosLosModulos = Array.from(modulosMap.values())

    // 5️⃣ Retornar permisos consolidados
    return {
      success: true,
      usuario_id: usuarioId,
      rol_id: usuario.rol,
      permisos: todosLosModulos,
      total: todosLosModulos.length,
    }
  }

  /**
   * 🔐 Asignar o actualizar permiso (módulo) a un usuario
   */
  async asignarModulo(usuarioId: number, asignarModuloDto: AsignarModuloDto) {
    const supabase = this.supabaseService.getClient()

    // 1️⃣ Verificar si ya existe
    const { data: existing } = await supabase
      .from("usuarios_modulos")
      .select("id")
      .eq("usuario_id", usuarioId)
      .eq("modulo_id", asignarModuloDto.modulo_id)
      .maybeSingle()

    if (existing) {
      // 2️⃣ Actualizar
      const { data, error } = await supabase
        .from("usuarios_modulos")
        .update({ concedido: asignarModuloDto.concedido })
        .eq("id", existing.id)
        .select()
        .single()

      if (error) throw error
      return data
    } else {
      // 3️⃣ Crear nuevo
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
