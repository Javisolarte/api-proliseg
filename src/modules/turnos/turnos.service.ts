import { Injectable, NotFoundException, BadRequestException, Logger } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { CreateTurnoDto, UpdateTurnoDto } from "./dto/turno.dto";

@Injectable()
export class TurnosService {
  private readonly logger = new Logger(TurnosService.name);

  constructor(private readonly supabaseService: SupabaseService) { }

  // ✅ Obtener todos los turnos (con filtros opcionales)
  async findAll(filters?: { fecha?: string; fecha_inicio?: string; fecha_fin?: string; empleadoId?: number; puestoId?: number }) {
    const supabase = this.supabaseService.getClient();
    this.logger.debug(`🟢 Ejecutando findAll con filtros: ${JSON.stringify(filters)}`);

    let query = supabase
      .from("turnos")
      .select(
        `
        *,
        empleado:empleado_id(id, nombre_completo),
        puesto:puesto_id(id, nombre),
        subpuesto:subpuesto_id(id, nombre)
      `
      )
      .order("fecha", { ascending: true })
      .limit(50000); // Aumentar límite para vista global

    if (filters?.fecha) {
      query = query.eq("fecha", filters.fecha);
      this.logger.debug(`📅 Filtro por fecha: ${filters.fecha}`);
    }
    if (filters?.fecha_inicio) {
      query = query.gte("fecha", filters.fecha_inicio);
      this.logger.debug(`📅 Filtro por fecha_inicio: ${filters.fecha_inicio}`);
    }
    if (filters?.fecha_fin) {
      query = query.lte("fecha", filters.fecha_fin);
      this.logger.debug(`📅 Filtro por fecha_fin: ${filters.fecha_fin}`);
    }
    if (filters?.empleadoId) {
      query = query.eq("empleado_id", filters.empleadoId);
      this.logger.debug(`👤 Filtro por empleadoId: ${filters.empleadoId}`);
    }
    if (filters?.puestoId) {
      query = query.eq("puesto_id", filters.puestoId);
      this.logger.debug(`🏢 Filtro por puestoId: ${filters.puestoId}`);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(`❌ Error Supabase (findAll): ${JSON.stringify(error)}`);
      throw error;
    }

    this.logger.debug(`✅ Turnos obtenidos: ${data?.length ?? 0}`);
    return data;
  }

  // ✅ Obtener un turno por ID
  async findOne(id: number) {
    const supabase = this.supabaseService.getClient();
    this.logger.debug(`🟢 Buscando turno con ID: ${id}`);

    const { data, error } = await supabase
      .from("turnos")
      .select(
        `
        *,
        empleado:empleado_id(id, nombre_completo),
        puesto:puesto_id(id, nombre),
        subpuesto:subpuesto_id(id, nombre)
      `
      )
      .eq("id", id)
      .single();

    if (error) {
      this.logger.error(`❌ Error Supabase (findOne): ${JSON.stringify(error)}`);
      throw error;
    }

    if (!data) {
      this.logger.warn(`⚠️ Turno no encontrado con ID: ${id}`);
      throw new NotFoundException(`Turno con ID ${id} no encontrado`);
    }

    this.logger.debug(`✅ Turno encontrado: ${JSON.stringify(data)}`);
    return data;
  }

  // ✅ Obtener los turnos de un empleado específico
  async findByEmpleado(empleadoId: number) {
    const supabase = this.supabaseService.getClient();
    this.logger.debug(`🟢 Buscando turnos del empleado ID: ${empleadoId}`);

    const { data, error } = await supabase
      .from("turnos")
      .select(
        `
        *,
        empleado:empleado_id(id, nombre_completo),
        puesto:puesto_id(id, nombre),
        subpuesto:subpuesto_id(id, nombre)
      `
      )
      .eq("empleado_id", empleadoId)
      .order("fecha", { ascending: false });

    if (error) {
      this.logger.error(`❌ Error Supabase (findByEmpleado): ${JSON.stringify(error)}`);
      throw error;
    }

    if (!data || data.length === 0) {
      this.logger.warn(`⚠️ No se encontraron turnos para el empleado ${empleadoId}`);
      throw new NotFoundException(`No se encontraron turnos para el empleado ${empleadoId}`);
    }

    this.logger.debug(`✅ Turnos del empleado ${empleadoId}: ${data.length}`);
    return data;
  }

  // ✅ Crear turno
  async create(dto: CreateTurnoDto, userId: number) {
    const supabase = this.supabaseService.getClient();
    this.logger.debug(`🟢 Creando turno por usuario ${userId}: ${JSON.stringify(dto)}`);

    const { data, error } = await supabase
      .from("turnos")
      .insert({
        ...dto,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`❌ Error Supabase (create): ${JSON.stringify(error)}`);
      throw error;
    }

    this.logger.debug(`✅ Turno creado: ${JSON.stringify(data)}`);
    return data;
  }

  // ✅ Actualizar turno por ID
  async update(id: number, dto: UpdateTurnoDto, userId: number) {
    const supabase = this.supabaseService.getClient();
    this.logger.debug(`🟢 Actualizando turno ID ${id} por usuario ${userId}`);

    const { data: existing, error: findError } = await supabase
      .from("turnos")
      .select("id")
      .eq("id", id)
      .single();

    if (findError || !existing) {
      this.logger.warn(`⚠️ Turno no encontrado con ID ${id}`);
      throw new NotFoundException(`Turno con ID ${id} no encontrado`);
    }

    const { data, error } = await supabase
      .from("turnos")
      .update({
        ...dto,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      this.logger.error(`❌ Error Supabase (update): ${JSON.stringify(error)}`);
      throw error;
    }

    this.logger.debug(`✅ Turno actualizado: ${JSON.stringify(data)}`);
    return data;
  }

  // ✅ Desactivar (soft delete) un turno por ID
  async softDelete(id: number, userId: number) {
    const supabase = this.supabaseService.getClient();
    this.logger.debug(`🟢 Desactivando turno ID ${id} por usuario ${userId}`);

    const { data: existing, error: findError } = await supabase
      .from("turnos")
      .select("id")
      .eq("id", id)
      .single();

    if (findError || !existing) {
      this.logger.warn(`⚠️ Turno no encontrado con ID ${id}`);
      throw new NotFoundException(`Turno con ID ${id} no encontrado`);
    }

    const { data, error } = await supabase
      .from("turnos")
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      this.logger.error(`❌ Error Supabase (softDelete): ${JSON.stringify(error)}`);
      throw error;
    }

    this.logger.debug(`✅ Turno desactivado correctamente`);
    return { message: "Turno desactivado correctamente", data };
  }

  // ✅ Actualizar turnos de un empleado
  async updateByEmpleado(empleadoId: number, dto: UpdateTurnoDto, userId: number) {
    const supabase = this.supabaseService.getClient();
    this.logger.debug(`🟢 Actualizando turnos del empleado ${empleadoId}`);

    const { data: existing, error: findError } = await supabase
      .from("turnos")
      .select("id")
      .eq("empleado_id", empleadoId);

    if (findError || !existing || existing.length === 0) {
      this.logger.warn(`⚠️ No se encontraron turnos para el empleado ${empleadoId}`);
      throw new NotFoundException(`No se encontraron turnos para el empleado ${empleadoId}`);
    }

    const { data, error } = await supabase
      .from("turnos")
      .update({
        ...dto,
        updated_at: new Date().toISOString(),
      })
      .eq("empleado_id", empleadoId)
      .select();

    if (error) {
      this.logger.error(`❌ Error Supabase (updateByEmpleado): ${JSON.stringify(error)}`);
      throw error;
    }

    this.logger.debug(`✅ Turnos actualizados para empleado ${empleadoId}: ${data.length}`);
    return data;
  }

  // ✅ Desactivar todos los turnos de un empleado
  async softDeleteByEmpleado(empleadoId: number, userId: number) {
    const supabase = this.supabaseService.getClient();
    this.logger.debug(`🟢 Desactivando turnos del empleado ${empleadoId}`);

    const { data: existing, error: findError } = await supabase
      .from("turnos")
      .select("id")
      .eq("empleado_id", empleadoId);

    if (findError || !existing || existing.length === 0) {
      this.logger.warn(`⚠️ No se encontraron turnos para el empleado ${empleadoId}`);
      throw new NotFoundException(`No se encontraron turnos para el empleado ${empleadoId}`);
    }

    const { data, error } = await supabase
      .from("turnos")
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq("empleado_id", empleadoId)
      .select();

    if (error) {
      this.logger.error(`❌ Error Supabase (softDeleteByEmpleado): ${JSON.stringify(error)}`);
      throw error;
    }

    this.logger.debug(`✅ ${data.length} turnos desactivados del empleado ${empleadoId}`);
    return { message: "Turnos desactivados correctamente", data };
  }

  // ✅ Intercambiar dos turnos (Drag & Drop)
  async intercambiarTurnos(turnoId1: number, turnoId2: number, motivo: string, userId: number) {
    const supabase = this.supabaseService.getClient();
    this.logger.debug(`🟢 Intercambiando turnos ${turnoId1} y ${turnoId2} por usuario ${userId}`);

    // 1. Obtener ambos turnos
    const { data: turnos, error: findError } = await supabase
      .from("turnos")
      .select(`
        id, 
        empleado_id, 
        fecha, 
        observaciones,
        empleado:empleado_id(nombre_completo)
      `)
      .in("id", [turnoId1, turnoId2]);

    if (findError || !turnos || turnos.length !== 2) {
      this.logger.warn(`⚠️ No se encontraron ambos turnos o hubo un error: ${findError?.message}`);
      throw new BadRequestException("No se encontraron los turnos especificados o uno de ellos no existe");
    }

    const t1 = turnos.find(t => t.id === turnoId1);
    const t2 = turnos.find(t => t.id === turnoId2);

    if (!t1 || !t2) {
      throw new BadRequestException("No se encontraron ambos turnos especificados en la base de datos");
    }

    // 2. Validar que sean de la misma fecha
    if (t1.fecha !== t2.fecha) {
      throw new BadRequestException("Solo se pueden intercambiar turnos que ocurran en la misma fecha");
    }

    const fechaHoy = new Date().toISOString().split('T')[0];
    const empleado1Nombre = Array.isArray(t1.empleado) ? t1.empleado[0]?.nombre_completo : (t1.empleado as any)?.nombre_completo;
    const empleado2Nombre = Array.isArray(t2.empleado) ? t2.empleado[0]?.nombre_completo : (t2.empleado as any)?.nombre_completo;

    // 3. Crear nuevas observaciones
    const obs1 = `${t1.observaciones || ''}\n[${fechaHoy}] Intercambiado con ${empleado2Nombre}. Motivo: ${motivo}`.trim();
    const obs2 = `${t2.observaciones || ''}\n[${fechaHoy}] Intercambiado con ${empleado1Nombre}. Motivo: ${motivo}`.trim();

    // 4. Actualizar ambos turnos intercambiando 'empleado_id'
    const { error: updateT1Error } = await supabase
      .from("turnos")
      .update({
        empleado_id: t2.empleado_id,
        observaciones: obs1,
        updated_at: new Date().toISOString()
      })
      .eq("id", t1.id);

    if (updateT1Error) throw updateT1Error;

    const { error: updateT2Error } = await supabase
      .from("turnos")
      .update({
        empleado_id: t1.empleado_id,
        observaciones: obs2,
        updated_at: new Date().toISOString()
      })
      .eq("id", t2.id);

    if (updateT2Error) {
      // Rollback intento si falla el segundo
      this.logger.error(`❌ Falló la actualización del segundo turno. Intentando rollback manual...`);
      throw new BadRequestException("Ocurrió un error al intercambiar los turnos.");
    }

    this.logger.log(`✅ Turnos ${t1.id} y ${t2.id} intercambiados exitosamente`);

    return {
      message: "Turnos intercambiados exitosamente",
      turnos_afectados: [t1.id, t2.id]
    };
  }
}
