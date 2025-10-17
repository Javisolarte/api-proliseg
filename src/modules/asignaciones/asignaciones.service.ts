import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import type { CreateAsignacionDto, UpdateAsignacionDto } from "./dto/asignacion.dto";

@Injectable()
export class AsignacionesService {
  private readonly logger = new Logger(AsignacionesService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  // 🔹 Listar todas las asignaciones
  async findAll() {
    const supabase = this.supabaseService.getClient();
    this.logger.debug("🧾 Buscando todas las asignaciones...");

    const { data, error } = await supabase
      .from("asignacion_guardas_puesto")
      .select(`
        *,
        empleados(id, nombre_completo, activo),
        puestos_trabajo(id, nombre)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      this.logger.error("❌ Error al listar asignaciones:", error);
      throw error;
    }

    this.logger.debug(`✅ ${data?.length || 0} asignaciones encontradas.`);
    return data;
  }

  // 🔹 Obtener una asignación por ID
  async findOne(id: number) {
    this.logger.debug(`🔍 Buscando asignación con ID: ${id}`);
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

    if (error || !data) {
      this.logger.warn(`⚠️ No se encontró la asignación con ID ${id}`);
      throw new NotFoundException(`Asignación con ID ${id} no encontrada`);
    }

    this.logger.debug(`✅ Asignación encontrada:\n${JSON.stringify(data, null, 2)}`);
    return data;
  }

  // 🔹 Crear nueva asignación
  async create(dto: CreateAsignacionDto) {
    this.logger.log("🆕 Creando nueva asignación...");
    this.logger.debug(`📥 DTO recibido:\n${JSON.stringify(dto, null, 2)}`);

    const supabase = this.supabaseService.getClient();

    // 🧱 Verificar empleado
    this.logger.debug(`🔎 Verificando existencia del empleado ID: ${dto.empleado_id}`);
    const { data: empleado, error: empError } = await supabase
      .from("empleados")
      .select("id, activo")
      .eq("id", dto.empleado_id)
      .single();

    if (empError) {
      this.logger.error(`❌ Error al verificar empleado ID ${dto.empleado_id}:`, empError);
      throw empError;
    }
    if (!empleado) throw new NotFoundException("Empleado no encontrado");
    if (!empleado.activo)
      throw new BadRequestException("No se puede asignar un empleado inactivo");

    // 🧱 Verificar puesto
    this.logger.debug(`🔎 Verificando puesto con ID: ${dto.puesto_id}`);
    const { data: puesto, error: puestoError } = await supabase
      .from("puestos_trabajo")
      .select("id, numero_guardas")
      .eq("id", dto.puesto_id)
      .single();

    if (puestoError) {
      this.logger.error("❌ Error al verificar puesto:", puestoError);
      throw puestoError;
    }
    if (!puesto) throw new NotFoundException("Puesto no encontrado");

    // 🧱 Verificar asignación activa existente
    this.logger.debug(`🔍 Buscando asignaciones activas del empleado ${dto.empleado_id} en el puesto ${dto.puesto_id}`);
    const { data: existing, error: existError } = await supabase
      .from("asignacion_guardas_puesto")
      .select("id, activo")
      .eq("empleado_id", dto.empleado_id)
      .eq("puesto_id", dto.puesto_id)
      .eq("activo", true)
      .maybeSingle();

    if (existError) {
      this.logger.error("❌ Error al verificar asignación existente:", existError);
      throw existError;
    }
    if (existing) {
      this.logger.warn("⚠️ El empleado ya tiene una asignación activa en este puesto.");
      throw new BadRequestException("El empleado ya está asignado a este puesto activo");
    }

    // 🧱 Preparar payload
    const payload = {
      ...dto,
      activo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 🧩 Validar tipos de payload antes de insertar
    this.logger.debug("🔎 Verificando tipos de campos del payload:");
    Object.entries(payload).forEach(([key, value]) => {
      this.logger.debug(`   • ${key}: ${value} (${typeof value})`);
    });

    // 🧱 Insertar en Supabase
    this.logger.debug(`📤 Enviando payload a Supabase:\n${JSON.stringify(payload, null, 2)}`);
    const { data, error } = await supabase
      .from("asignacion_guardas_puesto")
      .insert(payload)
      .select()
      .single();

    // 🧨 Manejo detallado del error
    if (error) {
      this.logger.error("❌ Error al insertar en asignacion_guardas_puesto:");
      this.logger.error(`🧱 Código: ${error.code || "N/A"}`);
      this.logger.error(`📜 Mensaje: ${error.message || "N/A"}`);
      this.logger.error(`📋 Detalles: ${error.details || "N/A"}`);
      this.logger.error(`💡 Hint: ${error.hint || "N/A"}`);
      this.logger.error(`📦 Payload enviado:\n${JSON.stringify(payload, null, 2)}`);

      throw new BadRequestException(`Error SQL ${error.code}: ${error.message}`);
    }

    this.logger.log(`✅ Asignación creada correctamente con ID ${data?.id}`);
    return { message: "Asignación creada exitosamente", data };
  }

  // 🔹 Actualizar asignación
  async update(id: number, dto: UpdateAsignacionDto) {
    this.logger.log(`🛠️ Actualizando asignación ID ${id}`);
    this.logger.debug(`📥 DTO recibido:\n${JSON.stringify(dto, null, 2)}`);

    const supabase = this.supabaseService.getClient();

    const { data: existing, error: findError } = await supabase
      .from("asignacion_guardas_puesto")
      .select("id")
      .eq("id", id)
      .single();

    if (findError || !existing) {
      this.logger.warn(`⚠️ No se encontró la asignación con ID ${id}`);
      throw new NotFoundException(`Asignación con ID ${id} no encontrada`);
    }

    const payload = {
      ...dto,
      updated_at: new Date().toISOString(),
    };

    this.logger.debug(`📤 Payload enviado a Supabase (update):\n${JSON.stringify(payload, null, 2)}`);

    const { data, error } = await supabase
      .from("asignacion_guardas_puesto")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      this.logger.error("❌ Error al actualizar asignación:");
      this.logger.error(`🧱 Código: ${error.code}`);
      this.logger.error(`📜 Mensaje: ${error.message}`);
      this.logger.error(`📋 Detalles: ${error.details || "N/A"}`);
      this.logger.error(`📦 Payload enviado:\n${JSON.stringify(payload, null, 2)}`);
      throw error;
    }

    this.logger.log(`✅ Asignación actualizada correctamente. ID: ${id}`);
    return { message: "Asignación actualizada exitosamente", data };
  }

  // 🔹 Eliminar (soft delete)
  async remove(id: number) {
    this.logger.log(`🗑️ Eliminando (soft delete) asignación ID ${id}`);
    const supabase = this.supabaseService.getClient();

    const { data: asignacion, error: findError } = await supabase
      .from("asignacion_guardas_puesto")
      .select("id, activo")
      .eq("id", id)
      .single();

    if (findError || !asignacion) {
      this.logger.warn(`⚠️ No se encontró la asignación con ID ${id}`);
      throw new NotFoundException(`Asignación con ID ${id} no encontrada`);
    }

    if (!asignacion.activo)
      throw new BadRequestException("La asignación ya está inactiva");

    const payload = {
      activo: false,
      updated_at: new Date().toISOString(),
    };

    this.logger.debug(`📤 Payload enviado a Supabase (soft delete):\n${JSON.stringify(payload, null, 2)}`);

    const { data, error } = await supabase
      .from("asignacion_guardas_puesto")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      this.logger.error("❌ Error al desactivar asignación:");
      this.logger.error(`🧱 Código: ${error.code}`);
      this.logger.error(`📜 Mensaje: ${error.message}`);
      this.logger.error(`📋 Detalles: ${error.details || "N/A"}`);
      this.logger.error(`📦 Payload enviado:\n${JSON.stringify(payload, null, 2)}`);
      throw error;
    }

    this.logger.log(`✅ Asignación desactivada correctamente (ID ${id})`);
    return { message: "Asignación eliminada (soft delete) exitosamente", data };
  }
}
