import { Injectable, NotFoundException, BadRequestException, Logger } from "@nestjs/common"
import { SupabaseService } from "../supabase/supabase.service"
import { AuthService } from "../auth/auth.service"
import type { CreateClienteDto, UpdateClienteDto } from "./dto/cliente.dto"

@Injectable()
export class ClientesService {
  private readonly logger = new Logger(ClientesService.name)

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly authService: AuthService
  ) {}

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
    const { access_email, password, ...clienteData } = createClienteDto

    let createdUsuarioId: number | null = null

    // 1. Si se proporcionan credenciales, crear el usuario primero
    if (access_email && password) {
      try {
        const userResult = await this.authService.register({
          email: access_email,
          password: password,
          nombre_completo: createClienteDto.nombre_empresa,
          cedula: createClienteDto.nit || 'N/A',
          telefono: createClienteDto.telefono,
          rol: 'cliente' // Rol predeterminado para clientes
        })

        if (userResult.success && userResult.user) {
          createdUsuarioId = userResult.user.id
        }
      } catch (error) {
        this.logger.error(`Error al crear usuario para el cliente: ${error.message}`)
        throw new BadRequestException(`No se pudo crear el usuario de acceso: ${error.message}`)
      }
    }

    // 2. Crear el cliente vinculado al usuario (si se creó)
    const { data, error } = await supabase
      .from("clientes")
      .insert({
        ...clienteData,
        usuario_id: createdUsuarioId || (clienteData as any).usuario_creador_id // Fallback al creador si no hay usuario propio
      })
      .select()
      .single()

    if (error) {
      // Si falla la creación del cliente y creamos un usuario, idealmente deberíamos revertir
      // Pero el register ya hace limpieza interna si falla su parte.
      throw error
    }

    return data
  }

  async update(id: number, updateClienteDto: UpdateClienteDto) {
    const supabase = this.supabaseService.getClient()
    // Evitar actualizar campos de acceso en el update del cliente por ahora
    const { access_email, password, ...clienteData } = updateClienteDto
    
    const { data, error } = await supabase.from("clientes").update(clienteData).eq("id", id).select().single()

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
