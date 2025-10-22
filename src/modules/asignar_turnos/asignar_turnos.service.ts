import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AsignarTurnosDto } from './dto/asignar_turnos.dto';

interface Empleado {
  id: number;
  nombre: string;
  [key: string]: any;
}

interface DetalleTurno {
  id: number;
  plazas: number;
  hora_inicio: string | null;
  hora_fin: string | null;
  tipo: string;
  orden: number;
  [key: string]: any;
}

@Injectable()
export class AsignarTurnosService {
  private readonly logger = new Logger(AsignarTurnosService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * 🧩 Generar turnos (incluye días de descanso)
   */
  async asignarTurnos(dto: AsignarTurnosDto) {
    const supabase = this.supabaseService.getClient();
    const { puesto_id, configuracion_id, fecha_inicio, asignado_por, subpuesto_id } = dto;
    this.logger.debug(`Iniciando asignación de turnos: ${JSON.stringify(dto)}`);

    // 🔹 Validar configuración
    const { data: config, error: configError } = await supabase
      .from('turnos_configuracion')
      .select('*')
      .eq('id', configuracion_id)
      .single();

    if (configError || !config) {
      this.logger.error(`Configuración no encontrada: ID ${configuracion_id}`);
      throw new NotFoundException('Configuración de turnos no encontrada');
    }

    // 🔹 Obtener empleados activos en el puesto
    let sqlEmpleados = `
      SELECT agp.id AS asignacion_id, e.*
      FROM asignacion_guardas_puesto agp
      JOIN empleados e ON e.id = agp.empleado_id
      WHERE agp.puesto_id = ${puesto_id} AND agp.activo = true AND e.activo = true
    `;
    if (subpuesto_id) sqlEmpleados += ` AND agp.subpuesto_id = ${subpuesto_id}`;

    const { data: empleadosData, error: empleadosError } = await supabase.rpc('exec_sql', { query: sqlEmpleados });
    const empleados: Empleado[] = (empleadosData ?? []) as Empleado[];

    if (empleadosError || empleados.length === 0) {
      this.logger.error(`No hay empleados activos para el puesto ${puesto_id}`);
      throw new BadRequestException('No hay empleados activos asignados a este puesto');
    }

    // 🔹 Obtener detalles de configuración
    const { data: detallesData, error: detallesError } = await supabase
      .from('turnos_detalle_configuracion')
      .select('*')
      .eq('configuracion_id', configuracion_id)
      .order('orden', { ascending: true });

    const detalles: DetalleTurno[] = (detallesData ?? []) as DetalleTurno[];

    if (detallesError || detalles.length === 0) {
      this.logger.error(`No hay detalles de configuración para ID ${configuracion_id}`);
      throw new BadRequestException('No hay detalles de configuración para generar turnos');
    }

    // 🔹 Generar turnos para 30 días (incluye descansos)
    const fechaBase = new Date(fecha_inicio);
    const turnosParaInsertar: any[] = [];
    const numeroDeDiasAGenerar = 30;
    const cicloLength = detalles.length;

    empleados.forEach((empleado, empleadoIndex) => {
      for (let dia = 0; dia < numeroDeDiasAGenerar; dia++) {
        const diaDelCiclo = (dia + empleadoIndex) % cicloLength;
        const detalle = detalles[diaDelCiclo];

        const fechaTurno = new Date(fechaBase);
        fechaTurno.setDate(fechaTurno.getDate() + dia);

        const tipoTurno = detalle.tipo?.toUpperCase() || 'NORMAL';
        const esDescanso = tipoTurno === 'DESCANSO';

        const turno = {
          empleado_id: empleado.id,
          puesto_id,
          subpuesto_id: subpuesto_id || null,
          fecha: fechaTurno.toISOString().split('T')[0],
          hora_inicio: esDescanso ? null : detalle.hora_inicio,
          hora_fin: esDescanso ? null : detalle.hora_fin,
          tipo_turno: tipoTurno,
          configuracion_id,
          orden_en_ciclo: detalle.orden,
          asignado_por,
          // ✅ Siempre válido según el constraint
          estado_turno: 'programado',
        };

        turnosParaInsertar.push(turno);
      }
    });

    // 🔹 Insertar todos los turnos
    if (turnosParaInsertar.length > 0) {
      const { error: insertError } = await supabase.from('turnos').insert(turnosParaInsertar);
      if (insertError) {
        this.logger.error(`Error creando turnos: ${JSON.stringify(insertError)}`);
        throw insertError;
      }
    }

    // 🔹 Registrar log de generación
    await supabase.from('turnos_generacion_log').insert({
      puesto_id,
      configuracion_id,
      mes: fechaBase.getMonth() + 1,
      año: fechaBase.getFullYear(),
      generado_por: asignado_por,
      subpuesto_id: subpuesto_id || null,
      descripcion: `Generados ${turnosParaInsertar.length} turnos (incluye descansos)`,
    });

    this.logger.log(`✅ Turnos generados: ${turnosParaInsertar.length}`);
    return { message: 'Turnos generados exitosamente', total_turnos: turnosParaInsertar.length };
  }

  /**
   * 🧠 Generación automática mensual (detecta si ya se generaron)
   */
  async generarTurnosAutomaticos() {
    const supabase = this.supabaseService.getClient();

    // Obtener todas las configuraciones
    const { data: configs, error } = await supabase
      .from('turnos_configuracion')
      .select('id, puesto_id');

    if (error || !configs) {
      this.logger.error('Error al obtener configuraciones de turnos');
      return;
    }

    const fechaActual = new Date();
    const mesActual = fechaActual.getMonth() + 1;
    const añoActual = fechaActual.getFullYear();

    for (const config of configs) {
      const { data: yaGenerado } = await supabase
        .from('turnos_generacion_log')
        .select('id')
        .eq('puesto_id', config.puesto_id)
        .eq('mes', mesActual)
        .eq('año', añoActual)
        .maybeSingle();

      if (!yaGenerado) {
        const dto = {
          puesto_id: config.puesto_id,
          configuracion_id: config.id,
          fecha_inicio: new Date(añoActual, mesActual - 1, 1).toISOString().split('T')[0],
          asignado_por: 'Sistema Automático',
        };

        await this.asignarTurnos(dto as any);
        this.logger.log(`🗓️ Turnos automáticos generados para puesto ${config.puesto_id} (${mesActual}/${añoActual})`);
      }
    }

    this.logger.log('✅ Verificación de generación automática completada.');
  }

  /**
   * 📋 Listar turnos por puesto/subpuesto
   */
  async listarTurnos(puesto_id: number, subpuesto_id?: number) {
    const supabase = this.supabaseService.getClient();
    let sql = `
      SELECT t.*, e.nombre AS empleado_nombre 
      FROM turnos t 
      JOIN empleados e ON e.id = t.empleado_id 
      WHERE t.puesto_id = ${puesto_id}
    `;
    if (subpuesto_id) sql += ` AND t.subpuesto_id = ${subpuesto_id}`;
    sql += ' ORDER BY t.fecha ASC, t.hora_inicio ASC';

    this.logger.debug(`SQL listarTurnos:\n${sql}`);
    const { data: turnosData, error } = await supabase.rpc('exec_sql', { query: sql });
    if (error) throw error;

    return (turnosData ?? []) as any[];
  }

  /**
   * 🗑️ Eliminar turnos programados en un rango de fechas
   */
  async eliminarTurnos(puesto_id: number, desde: string, hasta: string) {
    const supabase = this.supabaseService.getClient();
    const { data: eliminadoData, error } = await supabase
      .from('turnos')
      .delete()
      .eq('puesto_id', puesto_id)
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .eq('estado_turno', 'programado');

    if (error) throw error;
    const eliminados = (eliminadoData ?? []).length;
    this.logger.log(`✅ Turnos eliminados: ${eliminados}`);
    return { message: `Se eliminaron ${eliminados} turnos programados` };
  }
}
