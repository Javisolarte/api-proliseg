import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../modules/supabase/supabase.service';

/**
 * 🏢 PUESTOS HELPER SERVICE
 * 
 * Servicio auxiliar para obtener información de puestos según roles y permisos.
 * Usado para implementar filtros RLS granulares en diferentes módulos.
 */
@Injectable()
export class PuestosHelperService {
    private readonly logger = new Logger(PuestosHelperService.name);

    constructor(private readonly supabaseService: SupabaseService) { }

    /**
     * Obtener IDs de puestos asignados a un empleado
     * Usado para filtrar datos que un vigilante puede ver
     */
    async getPuestosAsignadosEmpleado(empleadoId: number): Promise<number[]> {
        const supabase = this.supabaseService.getClient();

        const { data, error } = await supabase
            .from('asignacion_guardas_puesto')
            .select('puesto_id, subpuesto_id')
            .eq('empleado_id', empleadoId)
            .eq('activo', true);

        if (error) {
            this.logger.error(`Error al obtener puestos asignados: ${error.message}`);
            return [];
        }

        const puestoIds = new Set<number>();
        data?.forEach((asignacion) => {
            if (asignacion.puesto_id) {
                puestoIds.add(asignacion.puesto_id);
            }
        });

        return Array.from(puestoIds);
    }

    /**
     * Obtener IDs de subpuestos asignados a un empleado
     */
    async getSubpuestosAsignadosEmpleado(empleadoId: number): Promise<number[]> {
        const supabase = this.supabaseService.getClient();

        const { data, error } = await supabase
            .from('asignacion_guardas_puesto')
            .select('subpuesto_id')
            .eq('empleado_id', empleadoId)
            .eq('activo', true)
            .not('subpuesto_id', 'is', null);

        if (error) {
            this.logger.error(`Error al obtener subpuestos asignados: ${error.message}`);
            return [];
        }

        return data?.map((a) => a.subpuesto_id).filter((id) => id !== null) || [];
    }

    /**
     * Obtener IDs de contratos de un cliente
     */
    async getContratoIdsCliente(clienteId: number): Promise<number[]> {
        const supabase = this.supabaseService.getClient();

        const { data, error } = await supabase
            .from('contratos')
            .select('id')
            .eq('cliente_id', clienteId);

        if (error) {
            this.logger.error(`Error al obtener contratos del cliente: ${error.message}`);
            return [];
        }

        return data?.map((c) => c.id) || [];
    }

    /**
     * Obtener IDs de puestos de un cliente (a través de sus contratos)
     */
    async getPuestoIdsCliente(clienteId: number): Promise<number[]> {
        const contratoIds = await this.getContratoIdsCliente(clienteId);

        if (contratoIds.length === 0) {
            return [];
        }

        const supabase = this.supabaseService.getClient();

        const { data, error } = await supabase
            .from('puestos_trabajo')
            .select('id')
            .in('contrato_id', contratoIds);

        if (error) {
            this.logger.error(`Error al obtener puestos del cliente: ${error.message}`);
            return [];
        }

        return data?.map((p) => p.id) || [];
    }

    /**
     * Verificar si un empleado está asignado a un puesto específico
     * Útil para validaciones en POST/PUT
     */
    async verificarAsignacionEmpleado(empleadoId: number, puestoId: number): Promise<boolean> {
        const supabase = this.supabaseService.getClient();

        const { count, error } = await supabase
            .from('asignacion_guardas_puesto')
            .select('*', { count: 'exact', head: true })
            .eq('empleado_id', empleadoId)
            .eq('puesto_id', puestoId)
            .eq('activo', true);

        if (error) {
            this.logger.error(`Error al verificar asignación: ${error.message}`);
            return false;
        }

        return (count || 0) > 0;
    }

    /**
     * Verificar si un empleado está asignado a un subpuesto específico
     */
    async verificarAsignacionSubpuesto(empleadoId: number, subpuestoId: number): Promise<boolean> {
        const supabase = this.supabaseService.getClient();

        const { count, error } = await supabase
            .from('asignacion_guardas_puesto')
            .select('*', { count: 'exact', head: true })
            .eq('empleado_id', empleadoId)
            .eq('subpuesto_id', subpuestoId)
            .eq('activo', true);

        if (error) {
            this.logger.error(`Error al verificar asignación de subpuesto: ${error.message}`);
            return false;
        }

        return (count || 0) > 0;
    }

    /**
     * Obtener información completa de asignaciones de un empleado
     */
    async getAsignacionesEmpleado(empleadoId: number) {
        const supabase = this.supabaseService.getClient();

        const { data, error } = await supabase
            .from('asignacion_guardas_puesto')
            .select(`
        id,
        puesto_id,
        subpuesto_id,
        fecha_asignacion,
        activo,
        puestos_trabajo(id, nombre, ciudad),
        subpuestos_trabajo(id, nombre)
      `)
            .eq('empleado_id', empleadoId)
            .eq('activo', true);

        if (error) {
            this.logger.error(`Error al obtener asignaciones: ${error.message}`);
            return [];
        }

        return data || [];
    }

    /**
     * Verificar si un puesto pertenece a un cliente
     */
    async verificarPuestoCliente(puestoId: number, clienteId: number): Promise<boolean> {
        const supabase = this.supabaseService.getClient();

        const { data, error } = await supabase
            .from('puestos_trabajo')
            .select('contrato_id, contratos(cliente_id)')
            .eq('id', puestoId)
            .single();

        if (error || !data) {
            return false;
        }

        return (data.contratos as any)?.cliente_id === clienteId;
    }
}
