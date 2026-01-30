import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AnalyticsService {
    private readonly logger = new Logger(AnalyticsService.name);

    constructor(private readonly supabaseService: SupabaseService) { }

    /**
     * Obtiene el cumplimiento de turnos por puesto
     */
    async getCumplimientoTurnos(filtros: { posto_id?: number; fecha_inicio?: string; fecha_fin?: string }) {
        try {
            const supabase = this.supabaseService.getClient();
            let query = `SELECT * FROM mv_kpi_cumplimiento_turnos WHERE 1=1`;

            if (filtros.posto_id) query += ` AND puesto_id = ${filtros.posto_id}`;
            if (filtros.fecha_inicio) query += ` AND dia >= '${filtros.fecha_inicio}'`;
            if (filtros.fecha_fin) query += ` AND dia <= '${filtros.fecha_fin}'`;

            const { data, error } = await supabase.rpc('exec_sql', { query });
            if (error) throw error;
            return data;
        } catch (error) {
            this.logger.error('Error en getCumplimientoTurnos:', error);
            throw new BadRequestException('Error al obtener KPIs de cumplimiento');
        }
    }

    /**
     * Obtiene horas trabajadas por empleado (Productividad)
     */
    async getHorasTrabajadas(filtros: { empleado_id?: number; mes?: string }) {
        try {
            const supabase = this.supabaseService.getClient();
            let query = `SELECT * FROM mv_fact_horas_trabajadas WHERE 1=1`;

            if (filtros.empleado_id) query += ` AND empleado_id = ${filtros.empleado_id}`;
            if (filtros.mes) query += ` AND mes = '${filtros.mes}'`;

            const { data, error } = await supabase.rpc('exec_sql', { query });
            if (error) throw error;
            return data;
        } catch (error) {
            this.logger.error('Error en getHorasTrabajadas:', error);
            throw new BadRequestException('Error al obtener KPIs de horas');
        }
    }

    /**
     * Obtiene estadísticas de incidentes por puesto/categoría
     */
    async getIncidentesStats(filtros: { puesto_id?: number; categoria?: string }) {
        try {
            const supabase = this.supabaseService.getClient();
            let query = `SELECT * FROM mv_stats_incidentes WHERE 1=1`;

            if (filtros.puesto_id) query += ` AND puesto_id = ${filtros.puesto_id}`;
            if (filtros.categoria) query += ` AND categoria = '${filtros.categoria}'`;

            const { data, error } = await supabase.rpc('exec_sql', { query });
            if (error) throw error;
            return data;
        } catch (error) {
            this.logger.error('Error en getIncidentesStats:', error);
            throw new BadRequestException('Error al obtener KPIs de incidentes');
        }
    }

    /**
     * Dispara el refresco de las vistas materializadas
     */
    async refreshMetrics() {
        try {
            const supabase = this.supabaseService.getClient();
            const { error } = await supabase.rpc('refresh_analytics_views');
            if (error) throw error;
            return { success: true, message: 'Métricas actualizadas correctamente' };
        } catch (error) {
            this.logger.error('Error refrescando métricas:', error);
            throw new BadRequestException('Error al refrescar métricas analíticas');
        }
    }
}
