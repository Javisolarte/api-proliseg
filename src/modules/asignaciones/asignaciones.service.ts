import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import type { CreateAsignacionDto, UpdateAsignacionDto } from "./dto/asignacion.dto";
import { AsignarTurnosService } from "../asignar_turnos/asignar_turnos.service";
import { TurnosHelperService } from "../../common/helpers/turnos-helper.service";

@Injectable()
export class AsignacionesService {
  private readonly logger = new Logger(AsignacionesService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly asignarTurnosService: AsignarTurnosService,
    private readonly turnosHelper: TurnosHelperService,
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

    // ✅ 4. Calcular empleados necesarios usando TurnosHelperService
    const empleadosNecesarios = await this.turnosHelper.calcularEmpleadosNecesarios(
      subpuesto.guardas_activos,
      subpuesto.configuracion_id
    );

    // Contar asignaciones activas actuales
    const { count: asignacionesActivas } = await supabase
      .from("asignacion_guardas_puesto")
      .select("*", { count: "exact", head: true })
      .eq("subpuesto_id", dto.subpuesto_id)
      .eq("activo", true);

    const empleadosAsignados = asignacionesActivas || 0;
    const cuposDisponibles = empleadosNecesarios - empleadosAsignados;

    if (cuposDisponibles <= 0) {
      this.logger.warn(
        `⚠️ Subpuesto ${subpuesto.nombre} sin cupos: ${empleadosAsignados}/${empleadosNecesarios} asignados`
      );
      throw new BadRequestException(
        `El subpuesto "${subpuesto.nombre}" ya tiene todos sus cupos ocupados ` +
        `(${empleadosAsignados}/${empleadosNecesarios} empleados asignados)`
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
      // --- NUEVOS CAMPOS BIOLÓGICOS ---
      rol_puesto: dto.rol_puesto ?? 'titular',
      patron_descanso: dto.patron_descanso ?? null,
      fecha_inicio_patron: dto.fecha_inicio_patron ?? new Date().toISOString().split('T')[0],
      // ---
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

    // ✅ UPDATE EMPLEADO: Marcar como asignado
    await supabase.from('empleados').update({ asignado: true }).eq('id', dto.empleado_id);

    // ✅ 6. Verificar si la asignación está completa DESPUÉS de esta nueva asignación
    const validacion = await this.turnosHelper.validarAsignacionCompleta(
      dto.subpuesto_id,
      subpuesto.guardas_activos,
      subpuesto.configuracion_id
    );

    this.logger.log(
      `📊 Estado de asignación: ${empleadosAsignados + 1}/${empleadosNecesarios} empleados asignados`
    );

    // ✅ 7. Si hay turnos pendientes de reasignación, reasignarlos
    this.logger.log(`🔍 Buscando turnos pendientes para reasignar a empleado ${dto.empleado_id}...`);
    const turnosReasignados = await this.reasignarTurnosPendientes(
      dto.subpuesto_id,
      dto.empleado_id
    );

    if (turnosReasignados > 0) {
      this.logger.log(
        `✅ ${turnosReasignados} turnos pendientes reasignados a ${empleado.nombre_completo}`
      );
    }

    // ✅ 8. SOLO generar turnos si la asignación está COMPLETA
    if (validacion.valido) {
      this.logger.log(`🎊 ¡ASIGNACIÓN COMPLETA DETECTADA! (ID Subpuesto: ${dto.subpuesto_id})`);
      try {
        this.logger.log(
          `🚀 Disparando regeneración automática de turnos para "${subpuesto.nombre}"...`
        );

        // Usar regenerarTurnos para limpiar turnos desactualizados y generar nuevos con el equipo completo
        const turnosResult = await this.asignarTurnosService.regenerarTurnos(
          dto.subpuesto_id,
          dto.asignado_por
        );

        // Mapear resultado para mantener consistencia con respuesta anterior
        const resultadoMapeado = {
          total_turnos: turnosResult.generados,
          empleados: empleadosNecesarios, // Aproximado
          detalle: turnosResult.detalle
        };

        this.logger.log(
          `✅ Turnos regenerados: ${turnosResult.generados} turnos creados`
        );

        return {
          message: "¡Asignación completada! Todos los empleados asignados y turnos generados exitosamente",
          asignacion,
          turnos_generados: turnosResult,
          asignacion_completa: true,
          empleados_asignados: empleadosAsignados + 1,
          empleados_necesarios: empleadosNecesarios,
        };
      } catch (err: any) {
        this.logger.warn(`⚠️ Error generando turnos: ${err.message}`);
        return {
          message: "Asignación completa pero no se pudieron generar turnos automáticamente",
          asignacion,
          warning: err.message,
          asignacion_completa: true,
          empleados_asignados: empleadosAsignados + 1,
          empleados_necesarios: empleadosNecesarios,
        };
      }
    } else {
      // Asignación incompleta - NO generar turnos
      this.logger.log(
        `⏳ Asignación incompleta. ${validacion.mensaje}. Los turnos se generarán automáticamente cuando se complete la asignación.`
      );

      return {
        message: `Empleado asignado exitosamente. ${validacion.mensaje}`,
        asignacion,
        turnos_reasignados: turnosReasignados > 0 ? turnosReasignados : undefined,
        asignacion_completa: false,
        empleados_asignados: empleadosAsignados + 1,
        empleados_necesarios: empleadosNecesarios,
        faltantes: validacion.faltantes,
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

  /**
   * 🗑️ Eliminar completamente una asignación (hard delete)
   * - Elimina TODOS los turnos relacionados a esta asignación
   * - Elimina la asignación de la base de datos permanentemente
   * - Actualiza el estado del empleado si no tiene otras asignaciones
   */
  async remove(id: number) {
    const supabase = this.supabaseService.getClient();

    // 1. Obtener asignación con detalles
    const { data: asignacion, error: asignError } = await supabase
      .from("asignacion_guardas_puesto")
      .select(`
        id,
        activo,
        empleado_id,
        subpuesto_id,
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

    const empleado = Array.isArray(asignacion.empleado)
      ? asignacion.empleado[0]
      : asignacion.empleado;
    const subpuesto = Array.isArray(asignacion.subpuesto)
      ? asignacion.subpuesto[0]
      : asignacion.subpuesto;

    // 2. Eliminar TODOS los turnos relacionados a esta asignación (pasados, presentes y futuros)
    const { data: turnosEliminados, error: turnosError } = await supabase
      .from("turnos")
      .delete()
      .eq("empleado_id", asignacion.empleado_id)
      .eq("subpuesto_id", asignacion.subpuesto_id)
      .select("id");

    const cantidadTurnosEliminados = turnosEliminados?.length || 0;

    if (turnosError) {
      this.logger.warn(`⚠️ Error eliminando turnos: ${turnosError.message}`);
    } else {
      this.logger.log(`🗑️ ${cantidadTurnosEliminados} turnos eliminados completamente`);
    }

    // 3. Verificar si el empleado tiene otras asignaciones activas
    const { count: otrasAsignaciones } = await supabase
      .from('asignacion_guardas_puesto')
      .select('*', { count: 'exact', head: true })
      .eq('empleado_id', asignacion.empleado_id)
      .eq('activo', true)
      .neq('id', id); // Excluir la asignación actual

    // 4. Si no tiene otras asignaciones activas, marcar empleado como no asignado
    if (!otrasAsignaciones || otrasAsignaciones === 0) {
      await supabase
        .from('empleados')
        .update({ asignado: false })
        .eq('id', asignacion.empleado_id);

      this.logger.log(`✅ Empleado ${empleado?.nombre_completo} marcado como no asignado`);
    }

    // 5. Eliminar la asignación permanentemente de la base de datos
    const { error: deleteError } = await supabase
      .from("asignacion_guardas_puesto")
      .delete()
      .eq("id", id);

    if (deleteError) {
      throw new BadRequestException(`Error al eliminar asignación: ${deleteError.message}`);
    }

    this.logger.log(
      `🗑️ Asignación ${id} eliminada completamente - Empleado: ${empleado?.nombre_completo}, Subpuesto: ${subpuesto?.nombre}`
    );

    return {
      message: "Asignación eliminada completamente",
      detalles: {
        asignacion_id: id,
        empleado: empleado?.nombre_completo,
        subpuesto: subpuesto?.nombre,
        turnos_eliminados: cantidadTurnosEliminados,
        empleado_desasignado: !otrasAsignaciones || otrasAsignaciones === 0
      }
    };
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

    // ✅ VERIFICAR OTRAS ASIGNACIONES ACTIVAS
    // Si el empleado no tiene otras asignaciones activas, marcar asignado = false
    const { count: otrasAsignaciones } = await supabase
      .from('asignacion_guardas_puesto')
      .select('*', { count: 'exact', head: true })
      .eq('empleado_id', asignacion.empleado_id)
      .eq('activo', true);

    if (!otrasAsignaciones || otrasAsignaciones === 0) {
      await supabase.from('empleados').update({ asignado: false }).eq('id', asignacion.empleado_id);
    }

    // 3. ELIMINAR turnos futuros (en lugar de marcarlos como pendientes)
    // El usuario solicitó: "se eliminen los turnos asignados al empleado"
    const { data: turnosEliminados, error: turnosError } = await supabase
      .from("turnos")
      .delete()
      .eq("empleado_id", asignacion.empleado_id)
      .eq("subpuesto_id", asignacion.subpuesto_id)
      .gte("fecha", fechaActual)
      .in("estado_turno", ["programado", "pendiente"])
      .select("id");

    const cantidadEliminados = turnosEliminados?.length || 0;

    if (turnosError) {
      this.logger.warn(`⚠️ Error eliminando turnos: ${turnosError.message}`);
    } else {
      this.logger.log(`🗑️ ${cantidadEliminados} turnos futuros eliminados para el empleado`);
    }

    this.logger.log(
      `✅ Empleado ${empleado?.nombre_completo} desasignado de ${subpuesto?.nombre} (Motivo: ${motivo})`
    );

    return {
      message: "Empleado desasignado exitosamente",
      asignacion: asignacionActualizada,
      turnos_eliminados: cantidadEliminados,
      detalles: {
        empleado: empleado?.nombre_completo,
        subpuesto: subpuesto?.nombre,
        motivo,
        fecha_desasignacion: fechaActual,
        turnos_eliminados: cantidadEliminados
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

  /**
   * 🔁 Reemplazar empleado sin romper turnos
   * Permite cambiar un empleado por otro manteniendo los turnos activos
   */
  async reemplazarEmpleado(
    asignacionId: number,
    nuevoEmpleadoId: number,
    motivo: string,
    motivoDetalle?: string
  ) {
    const supabase = this.supabaseService.getClient();

    // 1. Obtener asignación actual
    const { data: asignacionActual, error: asignError } = await supabase
      .from("asignacion_guardas_puesto")
      .select(`
        id,
        empleado_id,
        subpuesto_id,
        puesto_id,
        contrato_id,
        asignado_por,
        observaciones,
        empleado:empleado_id (
          id,
          nombre_completo
        ),
        subpuesto:subpuesto_id (
          id,
          nombre,
          guardas_activos,
          configuracion_id
        )
      `)
      .eq("id", asignacionId)
      .eq("activo", true)
      .single();

    if (asignError || !asignacionActual) {
      throw new NotFoundException(`Asignación con ID ${asignacionId} no encontrada o inactiva`);
    }

    const empleadoAnterior = Array.isArray(asignacionActual.empleado)
      ? asignacionActual.empleado[0]
      : asignacionActual.empleado;
    const subpuesto = Array.isArray(asignacionActual.subpuesto)
      ? asignacionActual.subpuesto[0]
      : asignacionActual.subpuesto;

    // 2. Verificar que el nuevo empleado exista y esté activo
    const { data: nuevoEmpleado, error: empError } = await supabase
      .from("empleados")
      .select("id, nombre_completo, activo")
      .eq("id", nuevoEmpleadoId)
      .single();

    if (empError || !nuevoEmpleado) {
      throw new NotFoundException("Nuevo empleado no encontrado");
    }

    if (!nuevoEmpleado.activo) {
      throw new BadRequestException("No se puede asignar un empleado inactivo");
    }

    // 3. Verificar que el nuevo empleado no esté ya asignado al mismo subpuesto
    const { data: existing } = await supabase
      .from("asignacion_guardas_puesto")
      .select("id")
      .eq("empleado_id", nuevoEmpleadoId)
      .eq("subpuesto_id", asignacionActual.subpuesto_id)
      .eq("activo", true)
      .maybeSingle();

    if (existing) {
      throw new BadRequestException(
        `El empleado ${nuevoEmpleado.nombre_completo} ya está asignado a este subpuesto`
      );
    }

    const fechaActual = new Date().toISOString().split('T')[0];
    const horaActual = new Date().toISOString().split('T')[1].split('.')[0];

    // 4. Desactivar asignación anterior
    const { error: updateError } = await supabase
      .from("asignacion_guardas_puesto")
      .update({
        activo: false,
        fecha_fin: fechaActual,
        hora_fin: horaActual,
        motivo_finalizacion: `Reemplazo: ${motivo}`,
        observaciones: `${asignacionActual.observaciones || ''}\n[${fechaActual}] Reemplazado por ${nuevoEmpleado.nombre_completo}: ${motivoDetalle || motivo}`.trim(),
        updated_at: new Date().toISOString()
      })
      .eq("id", asignacionId);

    if (updateError) {
      throw new BadRequestException(`Error al desactivar asignación anterior: ${updateError.message}`);
    }

    // 5. Crear nueva asignación para el empleado de reemplazo
    const { data: nuevaAsignacion, error: insertError } = await supabase
      .from("asignacion_guardas_puesto")
      .insert({
        empleado_id: nuevoEmpleadoId,
        puesto_id: asignacionActual.puesto_id,
        subpuesto_id: asignacionActual.subpuesto_id,
        contrato_id: asignacionActual.contrato_id,
        asignado_por: asignacionActual.asignado_por,
        observaciones: `Reemplazo de ${empleadoAnterior?.nombre_completo} - ${motivo}`,
        activo: true,
        fecha_asignacion: fechaActual,
        hora_asignacion: horaActual,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      throw new BadRequestException(`Error al crear nueva asignación: ${insertError.message}`);
    }

    // ✅ UPDATE NUEVO EMPLEADO: Marcar como asignado
    await supabase.from('empleados').update({ asignado: true }).eq('id', nuevoEmpleadoId);

    // ✅ UPDATE EMPLEADO ANTERIOR: Verificar si tiene otras asignaciones
    const { count: asignacionesAnterior } = await supabase
      .from('asignacion_guardas_puesto')
      .select('*', { count: 'exact', head: true })
      .eq('empleado_id', asignacionActual.empleado_id)
      .eq('activo', true);

    if (!asignacionesAnterior || asignacionesAnterior === 0) {
      await supabase.from('empleados').update({ asignado: false }).eq('id', asignacionActual.empleado_id);
    }

    // 6. Reasignar TODOS los turnos futuros del empleado anterior al nuevo empleado
    const { data: turnosReasignados, error: turnosError } = await supabase
      .from("turnos")
      .update({
        empleado_id: nuevoEmpleadoId,
        updated_at: new Date().toISOString()
      })
      .eq("empleado_id", asignacionActual.empleado_id)
      .eq("subpuesto_id", asignacionActual.subpuesto_id)
      .gte("fecha", fechaActual)
      .in("estado_turno", ["programado", "pendiente"])
      .select("id, fecha, tipo_turno");

    const turnosActualizados = turnosReasignados?.length || 0;

    if (turnosError) {
      this.logger.warn(`⚠️ Error reasignando turnos: ${turnosError.message}`);
    } else {
      this.logger.log(`✅ ${turnosActualizados} turnos reasignados al nuevo empleado`);
    }

    this.logger.log(
      `🔁 Empleado ${empleadoAnterior?.nombre_completo} reemplazado por ${nuevoEmpleado.nombre_completo} en ${subpuesto?.nombre}`
    );

    return {
      message: "Empleado reemplazado exitosamente sin romper turnos",
      asignacion_anterior: {
        id: asignacionId,
        empleado: empleadoAnterior?.nombre_completo,
        activo: false
      },
      asignacion_nueva: {
        id: nuevaAsignacion.id,
        empleado: nuevoEmpleado.nombre_completo,
        activo: true
      },
      turnos_reasignados: turnosActualizados,
      detalles: {
        subpuesto: subpuesto?.nombre,
        empleado_anterior: empleadoAnterior?.nombre_completo,
        empleado_nuevo: nuevoEmpleado.nombre_completo,
        motivo,
        fecha_reemplazo: fechaActual,
        turnos_afectados: turnosActualizados
      }
    };
  }
}
