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
  ) { }

  // 🔹 Listar todas las asignaciones
  async findAll() {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from("asignacion_guardas_puesto")
      .select(`
        *,
        empleado:empleado_id (
          id,
          nombre_completo,
          activo
        ),
        puesto:puesto_id (
          id,
          nombre
        ),
        subpuesto:subpuesto_id (
          id,
          nombre,
          configuracion:configuracion_id (
            id,
            nombre
          )
        )
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
        empleado:empleado_id (
          id,
          nombre_completo,
          activo
        ),
        puesto:puesto_id (
          id,
          nombre
        ),
        subpuesto:subpuesto_id (
          id,
          nombre,
          configuracion:configuracion_id (
            id,
            nombre
          )
        )
      `)
      .eq("id", id)
      .single();

    if (error || !data) throw new NotFoundException(`Asignación con ID ${id} no encontrada`);
    return data;
  }

  // 🔹 Crear nueva asignación
  async create(dto: CreateAsignacionDto) {
    const supabase = this.supabaseService.getClient();

    // ✅ 1. Verificar empleado
    const { data: empleado, error: empleadoError } = await supabase
      .from("empleados")
      .select("id, nombre_completo, activo")
      .eq("id", dto.empleado_id)
      .single();

    if (empleadoError || !empleado) {
      throw new NotFoundException("Empleado no encontrado");
    }
    if (!empleado.activo) {
      throw new BadRequestException("No se puede asignar un empleado inactivo");
    }

    // ✅ 2. Verificar subpuesto y obtener su configuración
    const { data: subpuesto, error: subpuestoError } = await supabase
      .from("subpuestos_trabajo")
      .select(`
        id,
        nombre,
        puesto_id,
        configuracion_id,
        guardas_activos,
        activo,
        puesto:puesto_id (
          id,
          nombre,
          contrato_id,
          activo
        ),
        configuracion:configuracion_id (
          id,
          nombre,
          activo
        )
      `)
      .eq("id", dto.subpuesto_id)
      .single();

    if (subpuestoError || !subpuesto) {
      throw new NotFoundException(`Subpuesto con ID ${dto.subpuesto_id} no encontrado`);
    }

    if (!subpuesto.activo) {
      throw new BadRequestException("El subpuesto no está activo");
    }

    if (!subpuesto.configuracion_id) {
      throw new BadRequestException(
        `El subpuesto "${subpuesto.nombre}" no tiene configuración de turnos asignada. ` +
        `Debe asignar una configuración antes de poder asignar empleados.`
      );
    }

    const configuracion = Array.isArray(subpuesto.configuracion)
      ? subpuesto.configuracion[0]
      : subpuesto.configuracion;

    if (!configuracion?.activo) {
      throw new BadRequestException(
        `La configuración de turnos del subpuesto "${subpuesto.nombre}" no está activa`
      );
    }

    const puesto = Array.isArray(subpuesto.puesto) ? subpuesto.puesto[0] : subpuesto.puesto;

    if (!puesto || !puesto.activo) {
      throw new BadRequestException("El puesto asociado al subpuesto no está activo");
    }

    // ✅ 3. Verificar que no exista asignación activa del empleado al mismo subpuesto
    const { data: existing } = await supabase
      .from("asignacion_guardas_puesto")
      .select("id, activo")
      .eq("empleado_id", dto.empleado_id)
      .eq("subpuesto_id", dto.subpuesto_id)
      .eq("activo", true)
      .maybeSingle();

    if (existing) {
      throw new BadRequestException(
        `El empleado ${empleado.nombre_completo} ya está asignado activamente al subpuesto ${subpuesto.nombre}`
      );
    }

    // ✅ 4. Verificar cupos disponibles en el subpuesto
    const { count: asignacionesActivas } = await supabase
      .from("asignacion_guardas_puesto")
      .select("*", { count: "exact", head: true })
      .eq("subpuesto_id", dto.subpuesto_id)
      .eq("activo", true);

    // Obtener guardas necesarios desde la vista
    const { data: guardasInfo } = await supabase
      .from("vw_guardas_necesarios_subpuesto")
      .select("guardas_necesarios")
      .eq("subpuesto_id", dto.subpuesto_id)
      .maybeSingle();

    const guardasNecesarios = guardasInfo?.guardas_necesarios || subpuesto.guardas_activos;
    const cuposDisponibles = guardasNecesarios - (asignacionesActivas || 0);

    if (cuposDisponibles <= 0) {
      this.logger.warn(
        `⚠️ Subpuesto ${subpuesto.nombre} sin cupos: ${asignacionesActivas}/${guardasNecesarios} asignados`
      );
      throw new BadRequestException(
        `El subpuesto "${subpuesto.nombre}" ya tiene todos sus cupos ocupados ` +
        `(${asignacionesActivas}/${guardasNecesarios} guardas asignados)`
      );
    }

    // ✅ 5. Insertar asignación
    const payload = {
      empleado_id: dto.empleado_id,
      puesto_id: puesto.id,
      subpuesto_id: dto.subpuesto_id,
      contrato_id: puesto.contrato_id,
      asignado_por: dto.asignado_por,
      observaciones: dto.observaciones,
      activo: true,
      fecha_asignacion: new Date().toISOString().split('T')[0],
      hora_asignacion: new Date().toISOString().split('T')[1].split('.')[0],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: asignacion, error: insertError } = await supabase
      .from("asignacion_guardas_puesto")
      .insert(payload)
      .select()
      .single();

    if (insertError) {
      this.logger.error(`❌ Error al crear asignación: ${insertError.message}`);
      throw new BadRequestException(`Error al crear asignación: ${insertError.message}`);
    }

    // ✅ 6. Verificar si hay turnos pendientes de asignación y reasignarlos
    const turnosReasignados = await this.reasignarTurnosPendientes(
      dto.subpuesto_id,
      dto.empleado_id
    );

    if (turnosReasignados > 0) {
      this.logger.log(
        `✅ Empleado ${empleado.nombre_completo} asignado y ${turnosReasignados} turnos pendientes reasignados`
      );

      return {
        message: "Asignación creada exitosamente y turnos pendientes reasignados",
        asignacion,
        turnos_reasignados: turnosReasignados,
        cupos_restantes: cuposDisponibles - 1,
      };
    }

    // ✅ 7. Si no hay turnos pendientes, generar turnos automáticamente
    try {
      this.logger.log(`🔄 Generando turnos automáticos para subpuesto ${subpuesto.nombre}...`);

      const turnosResult = await this.asignarTurnosService.asignarTurnos({
        subpuesto_id: dto.subpuesto_id,
        fecha_inicio: new Date().toISOString().split('T')[0],
        asignado_por: dto.asignado_por,
      });

      this.logger.log(
        `✅ Turnos generados automáticamente: ${turnosResult.total_turnos} turnos para ${turnosResult.empleados} empleados`
      );

      return {
        message: "Asignación creada exitosamente y turnos generados automáticamente",
        asignacion,
        turnos_generados: turnosResult,
        cupos_restantes: cuposDisponibles - 1,
      };
    } catch (err: any) {
      this.logger.warn(`⚠️ Asignación creada pero no se pudieron generar turnos: ${err.message}`);

      return {
        message: "Asignación creada exitosamente (turnos no generados automáticamente)",
        asignacion,
        warning: err.message,
        cupos_restantes: cuposDisponibles - 1,
      };
    }
  }

  // 🔹 Actualizar asignación
  async update(id: number, dto: UpdateAsignacionDto) {
    const supabase = this.supabaseService.getClient();

    const { data: existing } = await supabase
      .from("asignacion_guardas_puesto")
      .select("id, subpuesto_id, empleado_id")
      .eq("id", id)
      .single();

    if (!existing) {
      throw new NotFoundException(`Asignación con ID ${id} no encontrada`);
    }

    const payload = {
      ...dto,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from("asignacion_guardas_puesto")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    this.logger.log(`✅ Asignación ${id} actualizada`);
    return { message: "Asignación actualizada exitosamente", data };
  }

  // 🔹 Eliminar (soft delete) - Mantener para compatibilidad
  async remove(id: number) {
    return this.desasignar(id, "Eliminación manual");
  }

  /**
   * 🚫 Desasignar empleado de un subpuesto
   * - Marca la asignación como inactiva
   * - Marca los turnos futuros como "pendiente_asignar"
   * - Permite especificar motivo de desasignación
   */
  async desasignar(
    id: number,
    motivo: string,
    motivo_detalle?: string
  ) {
    const supabase = this.supabaseService.getClient();

    // 1. Obtener asignación con detalles
    const { data: asignacion, error: asignError } = await supabase
      .from("asignacion_guardas_puesto")
      .select(`
        id,
        activo,
        empleado_id,
        subpuesto_id,
        observaciones,
        empleado:empleado_id (
          id,
          nombre_completo
        ),
        subpuesto:subpuesto_id (
          id,
          nombre
        )
      `)
      .eq("id", id)
      .single();

    if (asignError || !asignacion) {
      throw new NotFoundException(`Asignación con ID ${id} no encontrada`);
    }

    if (!asignacion.activo) {
      throw new BadRequestException("La asignación ya está inactiva");
    }

    const empleado = Array.isArray(asignacion.empleado)
      ? asignacion.empleado[0]
      : asignacion.empleado;
    const subpuesto = Array.isArray(asignacion.subpuesto)
      ? asignacion.subpuesto[0]
      : asignacion.subpuesto;

    // 2. Desactivar asignación
    const fechaActual = new Date().toISOString().split('T')[0];
    const horaActual = new Date().toISOString().split('T')[1].split('.')[0];

    const { data: asignacionActualizada, error: updateError } = await supabase
      .from("asignacion_guardas_puesto")
      .update({
        activo: false,
        fecha_fin: fechaActual,
        hora_fin: horaActual,
        motivo_finalizacion: motivo,
        observaciones: motivo_detalle
          ? `${asignacion.observaciones || ''}\n[${fechaActual}] ${motivo}: ${motivo_detalle}`.trim()
          : asignacion.observaciones,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      throw new BadRequestException(`Error al desasignar: ${updateError.message}`);
    }

    // 3. Marcar turnos futuros como "pendiente_asignar"
    const { data: turnosFuturos, error: turnosError } = await supabase
      .from("turnos")
      .update({
        empleado_id: null,
        estado_turno: "pendiente_asignar",
        tipo_turno: "PENDIENTE",
        updated_at: new Date().toISOString()
      })
      .eq("empleado_id", asignacion.empleado_id)
      .eq("subpuesto_id", asignacion.subpuesto_id)
      .gte("fecha", fechaActual)
      .in("estado_turno", ["programado", "pendiente"])
      .select("id, fecha, hora_inicio, hora_fin");

    const turnosActualizados = turnosFuturos?.length || 0;

    if (turnosError) {
      this.logger.warn(`⚠️ Error actualizando turnos: ${turnosError.message}`);
    } else {
      this.logger.log(`📋 ${turnosActualizados} turnos marcados como pendientes de asignación`);
    }

    this.logger.log(
      `✅ Empleado ${empleado?.nombre_completo} desasignado de ${subpuesto?.nombre} (Motivo: ${motivo})`
    );

    return {
      message: "Empleado desasignado exitosamente",
      asignacion: asignacionActualizada,
      turnos_pendientes: turnosActualizados,
      detalles: {
        empleado: empleado?.nombre_completo,
        subpuesto: subpuesto?.nombre,
        motivo,
        fecha_desasignacion: fechaActual,
        turnos_afectados: turnosActualizados
      }
    };
  }

  /**
   * 🔄 Reasignar turnos pendientes a un nuevo empleado
   * Se ejecuta automáticamente al crear una nueva asignación
   */
  private async reasignarTurnosPendientes(
    subpuesto_id: number,
    nuevo_empleado_id: number
  ): Promise<number> {
    const supabase = this.supabaseService.getClient();
    const fechaActual = new Date().toISOString().split('T')[0];

    // Buscar turnos pendientes de asignación en este subpuesto
    const { data: turnosPendientes, error } = await supabase
      .from("turnos")
      .update({
        empleado_id: nuevo_empleado_id,
        estado_turno: "programado",
        tipo_turno: "NORMAL",
        updated_at: new Date().toISOString()
      })
      .eq("subpuesto_id", subpuesto_id)
      .gte("fecha", fechaActual)
      .eq("estado_turno", "pendiente_asignar")
      .is("empleado_id", null)
      .select("id");

    if (error) {
      this.logger.warn(`⚠️ Error reasignando turnos pendientes: ${error.message}`);
      return 0;
    }

    const reasignados = turnosPendientes?.length || 0;

    if (reasignados > 0) {
      this.logger.log(`🔄 ${reasignados} turnos pendientes reasignados al nuevo empleado`);
    }

    return reasignados;
  }
}
