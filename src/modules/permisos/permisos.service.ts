import { Injectable, NotFoundException, InternalServerErrorException, Logger } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { AsignarPermisoDto, ActualizarPermisoDto } from "./dto/permiso.dto";

@Injectable()
export class PermisosService {
  private readonly logger = new Logger(PermisosService.name);
  private readonly table = "roles_modulos_usuarios_externos";

  constructor(private readonly supabaseService: SupabaseService) {}

  /** 🧾 Listar todos los permisos */
  async listarPermisos() {
    const supabase = this.supabaseService.getSupabaseAdminClient();

    const { data, error } = await supabase
      .from(this.table)
      .select(`
        id,
        usuario_id,
        concedido,
        created_at,
        modulos (
          id,
          nombre,
          descripcion
        ),
        usuarios_externos (
          id,
          nombre_completo,
          rol
        )
      `)
      .order("id", { ascending: true });

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  /** 👤 Listar permisos de un usuario específico */
  async listarPermisosPorUsuario(usuario_id: number) {
    const supabase = this.supabaseService.getSupabaseAdminClient();

    const { data, error } = await supabase
      .from(this.table)
      .select(`
        id,
        concedido,
        modulos (id, nombre, descripcion)
      `)
      .eq("usuario_id", usuario_id);

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  /** ✅ Asignar permiso (usuario ↔ módulo) */
  async asignarPermiso(dto: AsignarPermisoDto) {
    const supabase = this.supabaseService.getSupabaseAdminClient();

    // Verificar si ya existe el permiso
    const { data: existente } = await supabase
      .from(this.table)
      .select("*")
      .eq("usuario_id", dto.usuario_id)
      .eq("modulo_id", dto.modulo_id)
      .maybeSingle();

    if (existente) {
      this.logger.warn(`Permiso ya existente. Actualizando...`);
      return this.actualizarPermiso(existente.id, { concedido: dto.concedido ?? true });
    }

    const { data, error } = await supabase.from(this.table).insert([dto]).select().single();

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  /** 📝 Actualizar permiso */
  async actualizarPermiso(id: number, dto: ActualizarPermisoDto) {
    const supabase = this.supabaseService.getSupabaseAdminClient();

    const { data, error } = await supabase
      .from(this.table)
      .update({ concedido: dto.concedido })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException(`Permiso con ID ${id} no encontrado`);
    return data;
  }

  /** ❌ Revocar permiso */
  async eliminarPermiso(id: number) {
    const supabase = this.supabaseService.getSupabaseAdminClient();
    const { data, error } = await supabase.from(this.table).delete().eq("id", id).select().single();

    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException(`Permiso con ID ${id} no encontrado`);
    return { mensaje: "Permiso eliminado correctamente", data };
  }
}
