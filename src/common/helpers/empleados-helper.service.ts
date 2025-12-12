import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../modules/supabase/supabase.service';
import { PuestosHelperService } from './puestos-helper.service';

/**
 * 👥 EMPLEADOS HELPER SERVICE
 * 
 * Servicio auxiliar para obtener información de empleados según roles y permisos.
 * Usado para implementar filtros RLS granulares en diferentes módulos.
 */
@Injectable()
export class EmpleadosHelperService {
    private readonly logger = new Logger(EmpleadosHelperService.name);

    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly puestosHelper: PuestosHelperService,
    ) { }

    /**
     * Obtener IDs de empleados asignados a puestos de un cliente
     * Usado para que el cliente vea solo empleados en sus contratos
     */
    async getEmpleadosAsignadosCliente(clienteId: number): Promise<number[]> {
        const puestoIds = await this.puestosHelper.getPuestoIdsCliente(clienteId);

        if (puestoIds.length === 0) {
            return [];
        }

        const supabase = this.supabaseService.getClient();

        const { data, error } = await supabase
            .from('asignacion_guardas_puesto')
            .select('empleado_id')
            .in('puesto_id', puestoIds)
            .eq('activo', true);

        if (error) {
            this.logger.error(`Error al obtener empleados del cliente: ${error.message}`);
            return [];
        }

        // Eliminar duplicados
        return [...new Set(data?.map((a) => a.empleado_id) || [])];
    }

    /**
     * Obtener IDs de empleados asignados a un puesto específico
     */
    async getEmpleadosAsignadosPuesto(puestoId: number): Promise<number[]> {
        const supabase = this.supabaseService.getClient();

        const { data, error } = await supabase
            .from('asignacion_guardas_puesto')
            .select('empleado_id')
            .eq('puesto_id', puestoId)
            .eq('activo', true);

        if (error) {
            this.logger.error(`Error al obtener empleados del puesto: ${error.message}`);
            return [];
        }

        return [...new Set(data?.map((a) => a.empleado_id) || [])];
    }

    /**
     * Obtener IDs de empleados asignados a un subpuesto específico
     */
    async getEmpleadosAsignadosSubpuesto(subpuestoId: number): Promise<number[]> {
        const supabase = this.supabaseService.getClient();

        const { data, error } = await supabase
            .from('asignacion_guardas_puesto')
            .select('empleado_id')
            .eq('subpuesto_id', subpuestoId)
            .eq('activo', true);

        if (error) {
            this.logger.error(`Error al obtener empleados del subpuesto: ${error.message}`);
            return [];
        }

        return [...new Set(data?.map((a) => a.empleado_id) || [])];
    }

    /**
     * Verificar si un empleado pertenece a los contratos de un cliente
     */
    async verificarEmpleadoCliente(empleadoId: number, clienteId: number): Promise<boolean> {
        const empleadosCliente = await this.getEmpleadosAsignadosCliente(clienteId);
        return empleadosCliente.includes(empleadoId);
    }

    /**
     * Obtener información de empleados con sus asignaciones
     * Útil para dashboards y reportes
     */
    async getEmpleadosConAsignaciones(empleadoIds?: number[]) {
        const supabase = this.supabaseService.getClient();

        let query = supabase
            .from('empleados')
            .select(`
        id,
        nombre_completo,
        cedula,
        telefono,
        activo,
        asignacion_guardas_puesto!inner(
          puesto_id,
          subpuesto_id,
          fecha_asignacion,
          activo,
          puestos_trabajo(id, nombre, ciudad),
          subpuestos_trabajo(id, nombre)
        )
      `)
            .eq('asignacion_guardas_puesto.activo', true);

        if (empleadoIds && empleadoIds.length > 0) {
            query = query.in('id', empleadoIds);
        }

        const { data, error } = await query;

        if (error) {
            this.logger.error(`Error al obtener empleados con asignaciones: ${error.message}`);
            return [];
        }

        return data || [];
    }

    /**
     * Obtener turnos de empleados específicos
     * Útil para filtrar turnos por empleados de un cliente
     */
    async getTurnosEmpleados(empleadoIds: number[], fechaInicio?: string, fechaFin?: string) {
        if (empleadoIds.length === 0) {
            return [];
        }

        const supabase = this.supabaseService.getClient();

        let query = supabase
            .from('turnos')
            .select(`
        id,
        empleado_id,
        puesto_id,
        fecha,
        hora_inicio,
        hora_fin,
        tipo_turno,
        estado_turno,
        empleados(nombre_completo),
        puestos_trabajo(nombre, ciudad)
      `)
            .in('empleado_id', empleadoIds)
            .order('fecha', { ascending: false });

        if (fechaInicio) {
            query = query.gte('fecha', fechaInicio);
        }

        if (fechaFin) {
            query = query.lte('fecha', fechaFin);
        }

        const { data, error } = await query;

        if (error) {
            this.logger.error(`Error al obtener turnos de empleados: ${error.message}`);
            return [];
        }

        return data || [];
    }
}
