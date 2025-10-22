import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import type { CreateAsignacionDto, UpdateAsignacionDto } from "./dto/asignacion.dto";
import { AsignarTurnosService } from "../asignar_turnos/asignar_turnos.service";

@Injectable()
export class AsignacionesService {
  private readonly logger = new Logger(AsignacionesService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly asignarTurnosService: AsignarTurnosService,
  ) {}

  // 🔹 Listar todas las asignaciones
  async findAll() {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from("asignacion_guardas_puesto")
      .select(`
        *,
        empleados(id, nombre_completo, activo),
        puestos_trabajo(id, nombre)
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  }

  // 🔹 Obtener una asignación por ID
  async findOne(id: number) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from("asignacion_guardas_puesto")
      .select(`
        *,
        empleados(id, nombre_completo, activo),
        puestos_trabajo(id, nombre)
      `)
      .eq("id", id)
      .single();

    if (error || !data) throw new NotFoundException(`Asignación con ID ${id} no encontrada`);
    return data;
  }

  // 🔹 Crear nueva asignación
  async create(dto: CreateAsignacionDto) {
    const supabase = this.supabaseService.getClient();

    // Verificar empleado
    const { data: empleado } = await supabase
      .from("empleados")
      .select("id, activo")
      .eq("id", dto.empleado_id)
      .single();

    if (!empleado) throw new NotFoundException("Empleado no encontrado");
    if (!empleado.activo) throw new BadRequestException("No se puede asignar un empleado inactivo");

    // Verificar puesto
    const { data: puesto } = await supabase
      .from("puestos_trabajo")
      .select("id, numero_guardas")
      .eq("id", dto.puesto_id)
      .single();

    if (!puesto) throw new NotFoundException("Puesto no encontrado");

    // Verificar asignación activa existente
    const { data: existing } = await supabase
      .from("asignacion_guardas_puesto")
      .select("id, activo")
      .eq("empleado_id", dto.empleado_id)
      .eq("puesto_id", dto.puesto_id)
      .eq("activo", true)
      .maybeSingle();

    if (existing) throw new BadRequestException("El empleado ya está asignado a este puesto activo");

    // Insertar asignación (sin configuracion_id)
    const payload = {
      empleado_id: dto.empleado_id,
      puesto_id: dto.puesto_id,
      subpuesto_id: dto.subpuesto_id,
      asignado_por: dto.asignado_por,
      observaciones: dto.observaciones,
      activo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      contrato_id: dto.contrato_id
    };

    const { data, error } = await supabase
      .from("asignacion_guardas_puesto")
      .insert(payload)
      .select()
      .single();

    if (error) throw new BadRequestException(`Error SQL: ${error.message}`);

    // 🔹 Generar turnos automáticamente
    try {
      await this.asignarTurnosService.asignarTurnos({
        puesto_id: dto.puesto_id,
        configuracion_id: dto.configuracion_id, // Solo se pasa al servicio de turnos
        fecha_inicio: new Date().toISOString(),
        asignado_por: dto.asignado_por,
        subpuesto_id: dto.subpuesto_id,
      });
    } catch (err) {
      this.logger.error(`Error generando turnos automáticos: ${err.message}`);
      // Opcional: decidir si revertir la asignación o solo loguear
    }

    return { message: "Asignación creada exitosamente", data };
  }

  // 🔹 Actualizar asignación
  async update(id: number, dto: UpdateAsignacionDto) {
    const supabase = this.supabaseService.getClient();
    const { data: existing } = await supabase
      .from("asignacion_guardas_puesto")
      .select("id")
      .eq("id", id)
      .single();

    if (!existing) throw new NotFoundException(`Asignación con ID ${id} no encontrada`);

    const payload = { ...dto, updated_at: new Date().toISOString() };
    const { data, error } = await supabase
      .from("asignacion_guardas_puesto")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return { message: "Asignación actualizada exitosamente", data };
  }

  // 🔹 Eliminar (soft delete)
  async remove(id: number) {
    const supabase = this.supabaseService.getClient();
    const { data: asignacion } = await supabase
      .from("asignacion_guardas_puesto")
      .select("id, activo")
      .eq("id", id)
      .single();

    if (!asignacion) throw new NotFoundException(`Asignación con ID ${id} no encontrada`);
    if (!asignacion.activo) throw new BadRequestException("La asignación ya está inactiva");

    const payload = { activo: false, updated_at: new Date().toISOString() };
    const { data, error } = await supabase
      .from("asignacion_guardas_puesto")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return { message: "Asignación eliminada (soft delete) exitosamente", data };
  }
}
