import { Injectable, NotFoundException, Logger } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import type { CreateEmpleadoDto, UpdateEmpleadoDto } from "./dto/empleado.dto";

@Injectable()
export class EmpleadosService {
  private readonly logger = new Logger(EmpleadosService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  // 🔹 Obtener todos los empleados con joins
  async findAll(filters?: { activo?: boolean; tipoEmpleadoId?: number }) {
    const supabase = this.supabaseService.getClient();
    this.logger.debug(`🟡 Ejecutando findAll con filtros: ${JSON.stringify(filters)}`);

    let sql = `
      SELECT e.*,
             eps.nombre AS eps_nombre,
             arl.nombre AS arl_nombre,
             fp.nombre AS fondo_pension_nombre,
             p.nombre AS puesto_nombre,
             u.nombre_completo AS creado_por_nombre
      FROM empleados e
      LEFT JOIN eps ON e.eps_id = eps.id
      LEFT JOIN arl ON e.arl_id = arl.id
      LEFT JOIN fondos_pension fp ON e.fondo_pension_id = fp.id
      LEFT JOIN puestos_trabajo p ON e.puesto_id = p.id
      LEFT JOIN usuarios_externos u ON e.creado_por = u.id
      WHERE 1=1
    `;

    if (filters?.activo !== undefined) sql += ` AND e.activo = ${filters.activo}`;
    if (filters?.tipoEmpleadoId) sql += ` AND e.tipo_empleado_id = ${filters.tipoEmpleadoId}`;

    sql += ` ORDER BY e.created_at DESC`;

    this.logger.debug(`📜 SQL Ejecutado:\n${sql}`);

    const { data, error } = await supabase.rpc("exec_sql", { query: sql });

    if (error) {
      this.logger.error(`❌ Error en Supabase RPC: ${JSON.stringify(error, null, 2)}`);
      throw error;
    }

    // 🚫 Ya no parseamos JSON (Supabase devuelve un objeto)
    const empleados = Array.isArray(data) ? data : [];

    this.logger.debug(`✅ Resultado Supabase (findAll): ${empleados.length} registros`);
    return empleados;
  }

  // 🔹 Obtener un empleado por ID con joins
  async findOne(id: number) {
    const supabase = this.supabaseService.getClient();
    this.logger.debug(`🔍 Buscando empleado con ID: ${id}`);

    const sql = `
      SELECT e.*,
             eps.nombre AS eps_nombre,
             arl.nombre AS arl_nombre,
             fp.nombre AS fondo_pension_nombre,
             p.nombre AS puesto_nombre,
             u.nombre_completo AS creado_por_nombre,
             uv.nombre_completo AS actualizado_por_nombre
      FROM empleados e
      LEFT JOIN eps ON e.eps_id = eps.id
      LEFT JOIN arl ON e.arl_id = arl.id
      LEFT JOIN fondos_pension fp ON e.fondo_pension_id = fp.id
      LEFT JOIN puestos_trabajo p ON e.puesto_id = p.id
      LEFT JOIN usuarios_externos u ON e.creado_por = u.id
      LEFT JOIN usuarios_externos uv ON e.actualizado_por = uv.id
      WHERE e.id = ${id}
      LIMIT 1
    `;

    this.logger.debug(`📜 SQL Ejecutado (findOne):\n${sql}`);

    const { data, error } = await supabase.rpc("exec_sql", { query: sql });

    if (error) {
      this.logger.error(`❌ Error en RPC findOne: ${JSON.stringify(error, null, 2)}`);
      throw error;
    }

    const empleados = Array.isArray(data) ? data : [];

    if (!empleados.length) {
      throw new NotFoundException(`Empleado con ID ${id} no encontrado`);
    }

    this.logger.debug(`🟢 Empleado encontrado: ${JSON.stringify(empleados[0], null, 2)}`);
    return empleados[0];
  }

  // 🔹 Crear empleado
  async create(createEmpleadoDto: CreateEmpleadoDto, userId: number) {
    const supabase = this.supabaseService.getClient();
    this.logger.debug(`🧩 Creando empleado con DTO: ${JSON.stringify(createEmpleadoDto)}`);

    const { data, error } = await supabase
      .from("empleados")
      .insert({
        ...createEmpleadoDto,
        creado_por: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`❌ Error al crear empleado: ${JSON.stringify(error, null, 2)}`);
      throw error;
    }

    this.logger.debug(`✅ Empleado creado: ${JSON.stringify(data, null, 2)}`);
    return data;
  }

  // 🔹 Actualizar empleado
  async update(id: number, updateEmpleadoDto: UpdateEmpleadoDto, userId: number) {
    const supabase = this.supabaseService.getClient();
    this.logger.debug(`🟡 Actualizando empleado ${id} con datos: ${JSON.stringify(updateEmpleadoDto)}`);

    const { data: existing, error: findError } = await supabase
      .from("empleados")
      .select("id")
      .eq("id", id)
      .single();

    if (findError || !existing) {
      throw new NotFoundException(`Empleado con ID ${id} no encontrado`);
    }

    const { data, error } = await supabase
      .from("empleados")
      .update({
        ...updateEmpleadoDto,
        actualizado_por: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      this.logger.error(`❌ Error al actualizar empleado: ${JSON.stringify(error, null, 2)}`);
      throw error;
    }

    this.logger.debug(`✅ Empleado actualizado: ${JSON.stringify(data, null, 2)}`);
    return data;
  }

  // 🔹 Soft delete
  async softDelete(id: number, userId: number) {
    const supabase = this.supabaseService.getClient();
    this.logger.debug(`🗑️ Eliminando (soft) empleado con ID: ${id}`);

    const { data: existing, error: findError } = await supabase
      .from("empleados")
      .select("id, activo")
      .eq("id", id)
      .single();

    if (findError || !existing) {
      throw new NotFoundException(`Empleado con ID ${id} no encontrado`);
    }

    const { data, error } = await supabase
      .from("empleados")
      .update({
        activo: false,
        fecha_salida: new Date().toISOString(),
        actualizado_por: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      this.logger.error(`❌ Error en soft delete: ${JSON.stringify(error, null, 2)}`);
      throw error;
    }

    this.logger.debug(`✅ Soft delete completado: ${JSON.stringify(data, null, 2)}`);
    return { message: "Empleado eliminado (soft delete) exitosamente", data };
  }

  // 🔹 Capacitaciones
  async getCapacitaciones(empleadoId: number) {
    const supabase = this.supabaseService.getClient();
    this.logger.debug(`📚 Consultando capacitaciones para empleado ID ${empleadoId}`);

    const { data, error } = await supabase
      .from("empleado_capacitaciones")
      .select(`
        *,
        capacitaciones(id, nombre, descripcion, duracion_horas, obligatoria)
      `)
      .eq("empleado_id", empleadoId)
      .order("fecha_realizacion", { ascending: false });

    if (error) {
      this.logger.error(`❌ Error obteniendo capacitaciones: ${JSON.stringify(error, null, 2)}`);
      throw error;
    }

    this.logger.debug(`📦 Capacitaciones obtenidas: ${data.length}`);
    return data;
  }
}
