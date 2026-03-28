import { Injectable, NotFoundException, BadRequestException, Logger } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { CreateTurnoDto, UpdateTurnoDto } from "./dto/turno.dto";

@Injectable()
export class TurnosService {
  private readonly logger = new Logger(TurnosService.name);

  constructor(private readonly supabaseService: SupabaseService) { }

  // ✅ Obtener todos los turnos (con filtros opcionales) con paginación automática
  async findAll(filters?: { fecha?: string; fecha_inicio?: string; fecha_fin?: string; empleadoId?: number; puestoId?: number }) {
    const supabase = this.supabaseService.getClient();
    this.logger.debug(`🟢 Ejecutando findAll con filtros: ${JSON.stringify(filters)}`);

    let allData: any[] = [];
    let from = 0;
    const step = 1000;
    let finished = false;

    while (!finished) {
      let query = supabase
        .from("turnos")
        .select(`*, empleado:empleado_id(id, nombre_completo), puesto:puesto_id(id, nombre, codigo_puesto), subpuesto:subpuesto_id(id, nombre)`)
        .order("fecha", { ascending: true })
        .range(from, from + step - 1);

      if (filters?.fecha) {
        query = query.eq("fecha", filters.fecha);
      }
      if (filters?.fecha_inicio) {
        query = query.gte("fecha", filters.fecha_inicio);
      }
      if (filters?.fecha_fin) {
        query = query.lte("fecha", filters.fecha_fin);
      }
      if (filters?.empleadoId) {
        query = query.eq("empleado_id", filters.empleadoId);
      }
      if (filters?.puestoId) {
        query = query.eq("puesto_id", filters.puestoId);
      }

      const { data, error } = await query;

      if (error) {
        this.logger.error(`❌ Error Supabase (findAll - range ${from}-${from + step - 1}): ${JSON.stringify(error)}`);
        throw error;
      }

      if (!data || data.length === 0) {
        finished = true;
      } else {
        allData = [...allData, ...data];
        if (data.length < step) {
          finished = true;
        } else {
          from += step;
        }
      }

      // Safety break to avoid infinite loops in case of unexpected API behavior
      if (from > 100000) {
        this.logger.warn("⚠️ findAll alcanzó el límite de seguridad de 100.000 filas");
        finished = true;
      }
    }

    this.logger.debug(`✅ Total turnos obtenidos: ${allData.length}`);
    return allData;
  }

  // ⚡ OPTIMIZADO: Endpoint rápido para grid-view con campos mínimos
  async findAllFast(filters?: { fecha_inicio?: string; fecha_fin?: string; puestoId?: number }) {
    const supabase = this.supabaseService.getClient();
    this.logger.debug(`⚡ Ejecutando findAllFast con filtros: ${JSON.stringify(filters)}`);

    // Solo los campos que el grid-view realmente necesita
    const selectFields = `id, empleado_id, puesto_id, subpuesto_id, fecha, tipo_turno, estado_turno, hora_inicio, hora_fin, observaciones, es_reemplazo, concepto_id, empleado:empleado_id(id, nombre_completo, cedula), puesto:puesto_id(id, nombre, codigo_puesto), subpuesto:subpuesto_id(id, nombre)`;

    let allData: any[] = [];
    let from = 0;
    const step = 1000;
    let finished = false;

    while (!finished) {
      let query = supabase
        .from("turnos")
        .select(selectFields)
        .order("fecha", { ascending: true })
        .range(from, from + step - 1);

      if (filters?.fecha_inicio) {
        query = query.gte("fecha", filters.fecha_inicio);
      }
      if (filters?.fecha_fin) {
        query = query.lte("fecha", filters.fecha_fin);
      }
      if (filters?.puestoId) {
        query = query.eq("puesto_id", filters.puestoId);
      }

      const { data, error } = await query;

      if (error) {
        this.logger.error(`❌ Error Supabase (findAllFast): ${JSON.stringify(error)}`);
        throw error;
      }

      if (!data || data.length === 0) {
        finished = true;
      } else {
        allData.push(...data);
        if (data.length < step) {
          finished = true;
        } else {
          from += step;
        }
      }

      if (from > 100000) {
        this.logger.warn("⚠️ findAllFast alcanzó el límite de seguridad");
        finished = true;
      }
    }

    this.logger.debug(`⚡ Total turnos (fast): ${allData.length}`);
    return allData;
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
        puesto:puesto_id(id, nombre, codigo_puesto),
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
        puesto:puesto_id(id, nombre, codigo_puesto),
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

    // 🛡️ Prevención de duplicados
    await this.checkForDuplicate(dto.empleado_id, dto.fecha, dto.hora_inicio, dto.hora_fin);

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

    // Buscar el turno actual para tener los valores base
    const { data: existing, error: findError } = await supabase
      .from("turnos")
      .select("id, empleado_id, fecha, hora_inicio, hora_fin")
      .eq("id", id)
      .single();

    if (findError || !existing) {
      this.logger.warn(`⚠️ Turno no encontrado con ID ${id}`);
      throw new NotFoundException(`Turno con ID ${id} no encontrado`);
    }

    // 🛡️ Prevención de duplicados (excluyendo el actual)
    if (dto.empleado_id || dto.fecha || dto.hora_inicio || dto.hora_fin) {
      await this.checkForDuplicate(
        dto.empleado_id || (existing as any).empleado_id,
        dto.fecha || (existing as any).fecha,
        dto.hora_inicio || (existing as any).hora_inicio,
        dto.hora_fin || (existing as any).hora_fin,
        id
      );
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

  // ✅ Eliminar un turno por ID (hard delete) con manejo de dependencias
  async softDelete(id: number, userId: number) {
    const supabase = this.supabaseService.getClient();
    this.logger.debug(`🟢 Eliminando turno ID ${id} por usuario ${userId}`);

    // 1. Verificar existencia y dependencias críticas (ejecuciones en curso)
    const { data: asignacion, error: checkError } = await supabase
      .from('rutas_supervision_asignacion')
      .select('id, rutas_supervision_ejecucion(id)')
      .eq('turno_id', id)
      .maybeSingle();

    if (asignacion && (asignacion as any).rutas_supervision_ejecucion?.length > 0) {
      throw new BadRequestException('No se puede eliminar el turno porque tiene una ruta de supervisión en ejecución o finalizada.');
    }

    // 2. Limpiar asignación de ruta si existe (DELETE en lugar de UPDATE NULL por constraint NOT NULL)
    if (asignacion) {
      await supabase.from('rutas_supervision_asignacion').delete().eq('id', asignacion.id);
      this.logger.log(`🔗 Eliminada asignación de ruta vinculada al turno ${id}`);
    }

    // 3. Eliminar el turno
    const { error } = await supabase
      .from("turnos")
      .delete()
      .eq("id", id);

    if (error) {
      this.logger.error(`❌ Error Supabase (delete): ${JSON.stringify(error)}`);
      throw error;
    }

    this.logger.debug(`✅ Turno eliminado correctamente`);
    return { message: "Turno eliminado correctamente" };
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

    // 2. Permitir intercambio entre fechas diferentes (ya no se bloquea)
    const esFechaDiferente = t1.fecha !== t2.fecha;

    const fechaHoy = new Date().toISOString().split('T')[0];
    const empleado1Nombre = Array.isArray(t1.empleado) ? t1.empleado[0]?.nombre_completo : (t1.empleado as any)?.nombre_completo;
    const empleado2Nombre = Array.isArray(t2.empleado) ? t2.empleado[0]?.nombre_completo : (t2.empleado as any)?.nombre_completo;

    // 3. Crear nuevas observaciones (incluir fechas si son diferentes)
    const fechaInfo = esFechaDiferente ? ` (Fecha origen: ${t1.fecha?.split('T')[0]}, Fecha destino: ${t2.fecha?.split('T')[0]})` : '';
    const obs1 = `${t1.observaciones || ''}\n[${fechaHoy}] Intercambiado con ${empleado2Nombre}${fechaInfo}. Motivo: ${motivo}`.trim();
    const obs2 = `${t2.observaciones || ''}\n[${fechaHoy}] Intercambiado con ${empleado1Nombre}${fechaInfo}. Motivo: ${motivo}`.trim();

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

  // 🛡️ Método privado para verificar duplicados u solapamientos
  private async checkForDuplicate(empleadoId: number, fecha: string, horaInicio: string | null, horaFin: string | null, excludeId?: number) {
    const supabase = this.supabaseService.getClient();

    let query = supabase
      .from("turnos")
      .select("id, tipo_turno, hora_inicio, hora_fin")
      .eq("empleado_id", empleadoId)
      .eq("fecha", fecha);

    if (excludeId) {
      query = query.neq("id", excludeId);
    }

    const { data: existingTurnos, error } = await query;

    if (error) {
      this.logger.error(`❌ Error verificando duplicados: ${JSON.stringify(error)}`);
      throw error;
    }

    if (existingTurnos && existingTurnos.length > 0) {
      // Verificar si hay solapamiento de horarios
      for (const t of existingTurnos) {
        const overlap = this.areIntervalsOverlapping(
          horaInicio, horaFin,
          t.hora_inicio, t.hora_fin
        );

        if (overlap) {
          throw new BadRequestException(
            `El empleado ya tiene un turno asignado (${t.tipo_turno}) en esta fecha (${fecha}) que se solapa con el horario solicitado (${horaInicio} - ${horaFin}).`
          );
        }
      }
    }
  }

  // Helper para verificar solapamiento de horas (formato HH:mm:ss)
  private areIntervalsOverlapping(start1: string | null, end1: string | null, start2: string | null, end2: string | null): boolean {
    if (!start1 || !end1 || !start2 || !end2) return false;

    const toMinutes = (time: string) => {
      const [h, m] = time.split(':').map(Number);
      return h * 60 + (m || 0);
    };

    let s1 = toMinutes(start1);
    let e1 = toMinutes(end1);
    let s2 = toMinutes(start2);
    let e2 = toMinutes(end2);

    // Manejo de turnos que cruzan la medianoche (e.g. 22:00 - 06:00)
    if (e1 <= s1) e1 += 24 * 60;
    if (e2 <= s2) e2 += 24 * 60;

    // Caso 1: Los rangos se solapan normalmente
    // (StartA < EndB) AND (EndA > StartB)
    const normalOverlap = (s1 < e2 && e1 > s2);
    
    // Caso 2: Considerar el solapamiento cíclico si uno de los turnos cruza la medianoche
    // (Aunque sumando 24*60 arriba cubrimos la mayoría de casos de una sola ventana de 24h)
    
    return normalOverlap;
  }
}
