import {
  Injectable,
  NotFoundException,
  Logger,
  InternalServerErrorException,
} from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import type { CreateServicioDto, UpdateServicioDto } from "./dto/servicio.dto";

@Injectable()
export class ServiciosService {
  private readonly logger = new Logger(ServiciosService.name);
  private readonly table = "tipo_servicio";

  constructor(private readonly supabaseService: SupabaseService) {}

  /** 🟢 Crear un nuevo tipo de servicio */
  async crear(dto: CreateServicioDto, userId?: number) {
    const supabase = this.supabaseService.getSupabaseAdminClient();
    this.logger.log("🟢 [crear] Iniciando creación de servicio...");
    this.logger.debug({ dto, userId });

    try {
      const payload = {
        ...dto,
        activo: dto.activo ?? true,
        creado_por: userId ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from(this.table)
        .insert([payload])
        .select()
        .single();

      if (error) {
        this.logger.error("❌ [crear] Error Supabase al insertar servicio:", error);
        throw new InternalServerErrorException(error.message);
      }

      this.logger.log(`✅ [crear] Servicio creado correctamente: ${data?.nombre || "sin nombre"}`);
      return data;
    } catch (err) {
      this.logger.error(`🚨 [crear] Excepción inesperada: ${err.message}`, err.stack);
      throw err;
    }
  }

  /** 📋 Listar todos los servicios */
  async listar() {
    const supabase = this.supabaseService.getSupabaseAdminClient();
    this.logger.log("📋 [listar] Consultando todos los servicios...");

    try {
      const { data, error } = await supabase
        .from(this.table)
        .select("*")
        .order("id", { ascending: true });

      if (error) {
        this.logger.error("❌ [listar] Error Supabase al listar servicios:", error);
        throw new InternalServerErrorException(error.message);
      }

      this.logger.log(`✅ [listar] Se encontraron ${data?.length || 0} servicios`);
      return data;
    } catch (err) {
      this.logger.error(`🚨 [listar] Excepción inesperada: ${err.message}`, err.stack);
      throw err;
    }
  }

  /** 🔍 Obtener un servicio por ID */
  async obtenerPorId(id: number) {
    const supabase = this.supabaseService.getSupabaseAdminClient();
    this.logger.log(`🔍 [obtenerPorId] Buscando servicio con ID ${id}...`);

    try {
      const { data, error } = await supabase
        .from(this.table)
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        this.logger.error(`❌ [obtenerPorId] Error Supabase al buscar servicio ${id}:`, error);
        throw new InternalServerErrorException(error.message);
      }

      if (!data) {
        this.logger.warn(`⚠️ [obtenerPorId] Servicio con ID ${id} no encontrado`);
        throw new NotFoundException(`Servicio con ID ${id} no encontrado`);
      }

      this.logger.log(`✅ [obtenerPorId] Servicio encontrado: ${data.nombre}`);
      return data;
    } catch (err) {
      this.logger.error(`🚨 [obtenerPorId] Excepción inesperada: ${err.message}`, err.stack);
      throw err;
    }
  }

  /** ✏️ Actualizar un servicio existente */
  async actualizar(id: number, dto: UpdateServicioDto, userId?: number) {
    const supabase = this.supabaseService.getSupabaseAdminClient();
    this.logger.log(`✏️ [actualizar] Intentando actualizar servicio ID: ${id}`);
    this.logger.debug({ dto, userId });

    try {
      const payload = {
        ...dto,
        actualizado_por: userId ?? null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from(this.table)
        .update(payload)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        this.logger.error(`❌ [actualizar] Error Supabase al actualizar servicio ${id}:`, error);
        throw new InternalServerErrorException(error.message);
      }

      if (!data) {
        this.logger.warn(`⚠️ [actualizar] Servicio con ID ${id} no encontrado para actualizar`);
        throw new NotFoundException(`Servicio con ID ${id} no encontrado`);
      }

      this.logger.log(`✅ [actualizar] Servicio actualizado correctamente ID: ${id}`);
      return data;
    } catch (err) {
      this.logger.error(`🚨 [actualizar] Excepción inesperada: ${err.message}`, err.stack);
      throw err;
    }
  }

  /** 🗑️ Eliminado lógico (activo = false) */
  async eliminar(id: number, userId?: number) {
    const supabase = this.supabaseService.getSupabaseAdminClient();
    this.logger.log(`🗑️ [eliminar] Marcando servicio ID ${id} como inactivo...`);

    try {
      const { data, error } = await supabase
        .from(this.table)
        .update({
          activo: false,
          actualizado_por: userId ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        this.logger.error(`❌ [eliminar] Error Supabase al eliminar servicio ${id}:`, error);
        throw new InternalServerErrorException(error.message);
      }

      if (!data) {
        this.logger.warn(`⚠️ [eliminar] Servicio con ID ${id} no encontrado`);
        throw new NotFoundException(`Servicio con ID ${id} no encontrado`);
      }

      this.logger.log(`✅ [eliminar] Servicio desactivado correctamente ID: ${id}`);
      return data;
    } catch (err) {
      this.logger.error(`🚨 [eliminar] Excepción inesperada: ${err.message}`, err.stack);
      throw err;
    }
  }

  /** 🌱 Insertar servicios base iniciales */
  async seedServiciosBase() {
    const supabase = this.supabaseService.getSupabaseAdminClient();
    this.logger.log("🌱 [seedServiciosBase] Insertando servicios base...");

    const servicios = [
      { nombre: "Vigilancia 24/7", categoria: "Vigilancia", descripcion: "Servicio permanente con relevos continuos en puesto fijo", modalidad: "24/7" },
      { nombre: "Vigilancia diurna", categoria: "Vigilancia", descripcion: "Cobertura de seguridad durante el día", modalidad: "12h diurna" },
      { nombre: "Vigilancia nocturna", categoria: "Vigilancia", descripcion: "Cobertura de seguridad durante la noche", modalidad: "12h nocturna" },
      { nombre: "Rondas o patrullaje móvil", categoria: "Vigilancia", descripcion: "Recorridos periódicos entre varios puntos de control", modalidad: "Variable" },
      { nombre: "Reacción motorizada", categoria: "Vigilancia", descripcion: "Apoyo móvil ante alarmas o emergencias", modalidad: "Rotativo" },
      { nombre: "Escolta ejecutiva", categoria: "Protección", descripcion: "Protección personal de directivos o personas con riesgo", modalidad: "Variable" },
      { nombre: "Escolta de carga", categoria: "Protección", descripcion: "Acompañamiento de vehículos de carga o mercancía", modalidad: "Por ruta" },
      { nombre: "Control de acceso / portería", categoria: "Especializado", descripcion: "Gestión de ingresos y registro de visitantes en instalaciones", modalidad: "12h o 24h" },
      { nombre: "Monitoreo CCTV", categoria: "Especializado", descripcion: "Supervisión de cámaras y sistemas de seguridad electrónica", modalidad: "24/7" },
    ];

    try {
      const { data, error } = await supabase
        .from(this.table)
        .insert(servicios)
        .select();

      if (error) {
        this.logger.error("❌ [seedServiciosBase] Error Supabase al insertar servicios base:", error);
        throw new InternalServerErrorException(error.message);
      }

      this.logger.log(`✅ [seedServiciosBase] ${data.length} servicios base insertados correctamente`);
      return data;
    } catch (err) {
      this.logger.error(`🚨 [seedServiciosBase] Excepción inesperada: ${err.message}`, err.stack);
      throw err;
    }
  }
}
