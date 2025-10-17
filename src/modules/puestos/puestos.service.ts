import { Injectable, NotFoundException, Logger } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import type { CreatePuestoDto, UpdatePuestoDto } from "./dto/puesto.dto";

@Injectable()
export class PuestosService {
  private readonly logger = new Logger(PuestosService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  // 🔹 Obtener todos los puestos
  async findAll() {
    this.logger.log("🔍 Iniciando búsqueda de todos los puestos de trabajo...");
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from("puestos_trabajo")
      .select(`
        *,
        contratos:contratos!puestos_trabajo_contrato_id_fkey(
          id,
          cliente_id,
          tipo_servicio_id,
          valor,
          fecha_inicio,
          fecha_fin,
          estado
        ),
        parent:parent_id(
          id,
          nombre,
          ciudad
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      this.logger.error(`❌ Error al obtener puestos: ${error.message}`, error.stack);
      throw error;
    }

    this.logger.log(`✅ ${data?.length || 0} puestos encontrados`);
    return data;
  }

  // 🔹 Obtener un puesto por ID
  async findOne(id: number) {
    this.logger.log(`🔍 Buscando puesto con ID: ${id}`);
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from("puestos_trabajo")
      .select(`
        *,
        contratos:contratos!puestos_trabajo_contrato_id_fkey(
          id,
          cliente_id,
          tipo_servicio_id,
          valor,
          fecha_inicio,
          fecha_fin,
          estado
        ),
        parent:parent_id(
          id,
          nombre,
          ciudad
        )
      `)
      .eq("id", id)
      .single();

    if (error) {
      this.logger.error(`❌ Error al consultar puesto ID ${id}: ${error.message}`);
      throw error;
    }

    if (!data) {
      this.logger.warn(`⚠️ No se encontró el puesto con ID ${id}`);
      throw new NotFoundException(`Puesto de trabajo con ID ${id} no encontrado`);
    }

    this.logger.log(`✅ Puesto encontrado: ${data.nombre || "(sin nombre)"}`);
    return data;
  }

  // 🔹 Crear puesto
  async create(dto: CreatePuestoDto, userId: number) {
    this.logger.log(`🆕 Creando nuevo puesto por usuario ID ${userId}`);
    this.logger.debug(`📦 Datos recibidos: ${JSON.stringify(dto)}`);
    const supabase = this.supabaseService.getClient();

    const now = new Date().toISOString();
    const payload = {
      ...dto,
      creado_por: userId,
      updated_at: now,
      created_at: now,
    };

    this.logger.verbose(`➡️ Insertando en tabla 'puestos_trabajo' con payload: ${JSON.stringify(payload)}`);

    const { data, error } = await supabase
      .from("puestos_trabajo")
      .insert(payload)
      .select()
      .single();

    if (error) {
      this.logger.error(`❌ Error al crear puesto: ${error.message}`, error.stack);
      throw error;
    }

    this.logger.log(`✅ Puesto creado exitosamente con ID: ${data.id}`);
    return data;
  }

  // 🔹 Actualizar puesto
  async update(id: number, dto: UpdatePuestoDto, userId: number) {
    this.logger.log(`🛠️ Actualizando puesto ID ${id} por usuario ${userId}`);
    this.logger.debug(`📦 Datos de actualización: ${JSON.stringify(dto)}`);

    const supabase = this.supabaseService.getClient();

    const { data: existing, error: findError } = await supabase
      .from("puestos_trabajo")
      .select("id")
      .eq("id", id)
      .single();

    if (findError) {
      this.logger.error(`❌ Error al verificar existencia del puesto ID ${id}: ${findError.message}`);
      throw findError;
    }

    if (!existing) {
      this.logger.warn(`⚠️ No se encontró el puesto con ID ${id} para actualizar`);
      throw new NotFoundException(`Puesto con ID ${id} no encontrado`);
    }

    const now = new Date().toISOString();
    const payload = {
      ...dto,
      actualizado_por: userId,
      updated_at: now,
    };

    this.logger.verbose(`➡️ Actualizando registro con payload: ${JSON.stringify(payload)}`);

    const { data, error } = await supabase
      .from("puestos_trabajo")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      this.logger.error(`❌ Error al actualizar puesto ID ${id}: ${error.message}`, error.stack);
      throw error;
    }

    this.logger.log(`✅ Puesto actualizado correctamente (ID: ${id})`);
    return data;
  }

  // 🔹 Eliminación lógica (soft delete)
  async softDelete(id: number, userId: number) {
    this.logger.log(`🗑️ Iniciando eliminación lógica del puesto ID ${id} por usuario ${userId}`);
    const supabase = this.supabaseService.getClient();

    const { data: existing, error: findError } = await supabase
      .from("puestos_trabajo")
      .select("id, activo")
      .eq("id", id)
      .single();

    if (findError) {
      this.logger.error(`❌ Error al verificar puesto ID ${id}: ${findError.message}`);
      throw findError;
    }

    if (!existing) {
      this.logger.warn(`⚠️ Puesto con ID ${id} no encontrado para eliminar`);
      throw new NotFoundException(`Puesto con ID ${id} no encontrado`);
    }

    const now = new Date().toISOString();
    this.logger.verbose(`➡️ Marcando puesto ID ${id} como inactivo`);

    const { data, error } = await supabase
      .from("puestos_trabajo")
      .update({
        activo: false,
        actualizado_por: userId,
        updated_at: now,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      this.logger.error(`❌ Error al marcar como inactivo el puesto ID ${id}: ${error.message}`, error.stack);
      throw error;
    }

    this.logger.log(`✅ Puesto ID ${id} marcado como inactivo correctamente`);
    return { message: "Puesto marcado como inactivo exitosamente", data };
  }
}
