import { Injectable, NotFoundException, Logger } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import type { CreateNotificacionDto, UpdateNotificacionDto } from "./dto/notificacion.dto";

@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);

  constructor(private readonly supabaseService: SupabaseService) { }

  async findAll() {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from("notificaciones")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  }

  async findOne(id: number) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from("notificaciones")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) throw new NotFoundException(`Notificación con ID ${id} no encontrada`);
    return data;
  }

  async create(createNotificacionDto: CreateNotificacionDto) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from("notificaciones")
      .insert(createNotificacionDto)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id: number, updateNotificacionDto: UpdateNotificacionDto) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from("notificaciones")
      .update(updateNotificacionDto)
      .eq("id", id)
      .select()
      .single();

    if (error || !data) throw new NotFoundException(`Notificación con ID ${id} no encontrada`);
    return data;
  }

  async remove(id: number) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from("notificaciones")
      .delete()
      .eq("id", id)
      .select()
      .single();

    if (error || !data) throw new NotFoundException(`Notificación con ID ${id} no encontrada`);
    return { message: "Notificación eliminada exitosamente", data };
  }

  /**
   * 🔔 Crear notificación de empleados faltantes en subpuesto
   */
  async crearNotificacionEmpleadosFaltantes(
    subpuesto_id: number,
    puesto_nombre: string,
    subpuesto_nombre: string,
    empleados_faltantes: number,
    guardas_necesarios: number,
    empleados_asignados: number,
    para_usuario_id?: number
  ) {
    const supabase = this.supabaseService.getClient();

    const mensaje = `⚠️ ALERTA: El puesto "${puesto_nombre}" - Subpuesto "${subpuesto_nombre}" necesita ${guardas_necesarios} empleados pero solo tiene ${empleados_asignados} asignados. Faltan ${empleados_faltantes} empleado(s) por asignar.`;

    const { data, error } = await supabase
      .from("notificaciones")
      .insert({
        para_usuario_id: para_usuario_id || null,
        mensaje,
        tipo: 'sistema',
        categoria: 'asignacion_incompleta',
        leido: false,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Error creando notificación: ${error.message}`);
      return null;
    }

    this.logger.log(`📢 Notificación creada: ${empleados_faltantes} empleados faltantes en ${subpuesto_nombre}`);
    return data;
  }

  /**
   * 🔍 Verificar asignaciones incompletas y crear notificaciones
   */
  async verificarAsignacionesIncompletas() {
    const supabase = this.supabaseService.getClient();

    this.logger.log('🔍 Verificando asignaciones incompletas...');

    // Obtener todos los subpuestos activos
    const { data: subpuestos } = await supabase
      .from('subpuestos_trabajo')
      .select(`
        id,
        nombre,
        guardas_activos,
        puesto:puesto_id (
          id,
          nombre
        ),
        configuracion:configuracion_id (
          id,
          dias_ciclo
        )
      `)
      .eq('activo', true);

    if (!subpuestos || subpuestos.length === 0) {
      this.logger.log('No hay subpuestos activos para verificar');
      return { verificados: 0, notificaciones_creadas: 0 };
    }

    let notificacionesCreadas = 0;

    for (const subpuesto of subpuestos) {
      const puesto = Array.isArray(subpuesto.puesto) ? subpuesto.puesto[0] : subpuesto.puesto;
      const configuracion = Array.isArray(subpuesto.configuracion)
        ? subpuesto.configuracion[0]
        : subpuesto.configuracion;

      if (!configuracion || !puesto) continue;

      // Calcular guardas necesarios
      const { data: vistaData } = await supabase
        .from('vw_guardas_necesarios_subpuesto')
        .select('guardas_necesarios')
        .eq('subpuesto_id', subpuesto.id)
        .maybeSingle();

      const guardasNecesarios = vistaData?.guardas_necesarios || subpuesto.guardas_activos;

      // Contar empleados asignados
      const { count: empleadosAsignados } = await supabase
        .from('asignacion_guardas_puesto')
        .select('*', { count: 'exact', head: true })
        .eq('subpuesto_id', subpuesto.id)
        .eq('activo', true);

      const faltantes = guardasNecesarios - (empleadosAsignados || 0);

      // Si faltan empleados, crear notificación
      if (faltantes > 0) {
        // Verificar si ya existe una notificación similar reciente (últimas 24 horas)
        const hace24Horas = new Date();
        hace24Horas.setHours(hace24Horas.getHours() - 24);

        const { data: notificacionExistente } = await supabase
          .from('notificaciones')
          .select('id')
          .eq('categoria', 'asignacion_incompleta')
          .ilike('mensaje', `%${subpuesto.nombre}%`)
          .gte('created_at', hace24Horas.toISOString())
          .maybeSingle();

        if (!notificacionExistente) {
          await this.crearNotificacionEmpleadosFaltantes(
            subpuesto.id,
            puesto.nombre,
            subpuesto.nombre,
            faltantes,
            guardasNecesarios,
            empleadosAsignados || 0
          );
          notificacionesCreadas++;
        }
      }
    }

    this.logger.log(`✅ Verificación completada: ${notificacionesCreadas} notificaciones creadas`);

    return {
      verificados: subpuestos.length,
      notificaciones_creadas: notificacionesCreadas
    };
  }
}
