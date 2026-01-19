import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import type {
  CreateTurnoConfiguracionDto,
  UpdateTurnoConfiguracionDto,
} from "./dto/turno_configuracion.dto";

@Injectable()
export class TurnosConfiguracionService {
  private readonly logger = new Logger(TurnosConfiguracionService.name);

  constructor(private readonly supabaseService: SupabaseService) { }

  // 🔹 Listar todas las configuraciones
  async findAll() {
    const supabase = this.supabaseService.getClient();
    this.logger.log("🟢 Buscando todas las configuraciones de turnos...");

    const { data, error } = await supabase
      .from("turnos_configuracion")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      this.logger.error("❌ Error al obtener configuraciones", error);
      throw error;
    }

    this.logger.log(`✅ Se encontraron ${data?.length ?? 0} configuraciones`);
    return data;
  }

  // 🔹 Obtener una configuración por ID
  async findOne(id: number) {
    const supabase = this.supabaseService.getClient();
    this.logger.log(`🟢 Buscando configuración de turno con ID: ${id}`);

    const { data, error } = await supabase
      .from("turnos_configuracion")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      this.logger.warn(`⚠️ Configuración con ID ${id} no encontrada`);
      throw new NotFoundException(
        `Configuración de turno con ID ${id} no encontrada`,
      );
    }

    this.logger.log(`✅ Configuración con ID ${id} encontrada`);
    return data;
  }

  // 🔹 Crear configuración CON detalles
  async create(dto: CreateTurnoConfiguracionDto, userId: number) {
    const supabase = this.supabaseService.getClient();
    this.logger.log(`🟢 Creando nueva configuración de turno por usuario ${userId}`);

    // Extraer detalles del DTO para insertarlos por separado
    const { detalles, ...configData } = dto;

    // 1. Insertar configuración principal
    const { data: config, error: configError } = await supabase
      .from("turnos_configuracion")
      .insert({
        ...configData,
        activo: dto.activo ?? true,
        tipo_proyeccion: dto.tipo_proyeccion ?? 'ciclico',
      })
      .select()
      .single();

    if (configError) {
      this.logger.error("❌ Error al crear configuración de turno", configError);
      throw configError;
    }

    this.logger.log(`✅ Configuración creada con ID: ${config.id}`);

    // 2. Insertar detalles si existen
    if (detalles && detalles.length > 0) {
      const detallesConConfigId = detalles.map(detalle => ({
        configuracion_id: config.id,
        orden: detalle.orden,
        tipo: detalle.tipo,
        hora_inicio: detalle.hora_inicio,
        hora_fin: detalle.hora_fin,
        plazas: detalle.plazas ?? 1,
        dias_semana: detalle.dias_semana ?? null,
        aplica_festivos: detalle.aplica_festivos ?? 'indiferente',
      }));

      const { error: detallesError } = await supabase
        .from("turnos_detalle_configuracion")
        .insert(detallesConConfigId);

      if (detallesError) {
        this.logger.error("❌ Error al crear detalles de configuración", detallesError);
        // Rollback: Eliminar la configuración principal si fallan los detalles
        await supabase.from("turnos_configuracion").delete().eq("id", config.id);
        throw detallesError;
      }

      this.logger.log(`✅ ${detalles.length} detalles/reglas insertados para configuración ${config.id}`);
    }

    // 3. Retornar configuración con sus detalles
    const { data: configCompleta } = await supabase
      .from("turnos_configuracion")
      .select(`
        *,
        detalles:turnos_detalle_configuracion (*)
      `)
      .eq("id", config.id)
      .single();

    return configCompleta || config;
  }


  // 🔹 Actualizar configuración
  async update(id: number, dto: UpdateTurnoConfiguracionDto, userId: number) {
    const supabase = this.supabaseService.getClient();
    this.logger.log(`🟢 Actualizando configuración de turno con ID: ${id}`);

    const { data: existing, error: findError } = await supabase
      .from("turnos_configuracion")
      .select("id")
      .eq("id", id)
      .single();

    if (findError || !existing) {
      this.logger.warn(`⚠️ Configuración con ID ${id} no encontrada para actualización`);
      throw new NotFoundException(`Configuración con ID ${id} no encontrada`);
    }

    const { data, error } = await supabase
      .from("turnos_configuracion")
      .update({
        ...dto,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      this.logger.error(`❌ Error al actualizar configuración con ID ${id}`, error);
      throw error;
    }

    this.logger.log(`✅ Configuración con ID ${id} actualizada correctamente`);
    return data;
  }

  // 🔹 Soft delete (desactivar)
  async softDelete(id: number, userId: number) {
    const supabase = this.supabaseService.getClient();
    this.logger.log(`🟡 Desactivando configuración de turno con ID: ${id}`);

    const { data: existing, error: findError } = await supabase
      .from("turnos_configuracion")
      .select("id, activo")
      .eq("id", id)
      .single();

    if (findError || !existing) {
      this.logger.warn(`⚠️ Configuración con ID ${id} no encontrada para desactivar`);
      throw new NotFoundException(
        `Configuración de turno con ID ${id} no encontrada`,
      );
    }

    const { data, error } = await supabase
      .from("turnos_configuracion")
      .update({
        activo: false,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      this.logger.error(`❌ Error al desactivar configuración con ID ${id}`, error);
      throw error;
    }

    this.logger.log(`✅ Configuración con ID ${id} desactivada correctamente`);
    return { message: "Configuración de turno desactivada exitosamente", data };
  }
}
