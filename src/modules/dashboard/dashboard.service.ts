import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { RlsHelperService } from '../../common/services/rls-helper.service';
import { RlsContext } from '../../config/permissions.config';
import type {
    VigilanteDashboardDto,
    ClienteDashboardDto,
    SupervisorDashboardDto,
    AdminDashboardDto,
    OverviewMetricDto,
    MonthlyRevenueDto,
    RecentActivityDto,
    AsistenciaStatsDto,
    CapacitacionesStatsDto,
    TurnoDetailDto,
    ContratoDetailDto,
    PuestoDetailDto,
    IncidenteStatsDto,
    SupervisionStatsDto,
    EmpleadosStatsDto,
    FinancialSummaryDto,
} from './dto/dashboard.dto';

/**
 * 📊 SERVICIO DE DASHBOARD EXPANDIDO CON SOPORTE RLS
 * 
 * Dashboards personalizados por rol con estadísticas detalladas:
 * - Vigilante: Solo sus datos (empleado_id)
 * - Cliente: Solo sus contratos (cliente_id)
 * - Supervisor: Supervisión operativa (SIN finanzas)
 * - Coordinador/Admin/Gerencia/Superusuario: Todos los datos + finanzas
 */
@Injectable()
export class DashboardService {
    private readonly logger = new Logger(DashboardService.name);

    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly rlsHelper: RlsHelperService,
    ) { }

    /**
     * Obtener dashboard según el rol del usuario
     */
    async getDashboard(rlsContext: RlsContext): Promise<any> {
        this.logger.log(`Getting dashboard for role: ${rlsContext.rol}`);

        switch (rlsContext.rol) {
            case 'vigilante':
                return this.getVigilanteDashboard(rlsContext);
            case 'cliente':
                return this.getClienteDashboard(rlsContext);
            case 'supervisor':
                return this.getSupervisorDashboard(rlsContext);
            case 'coordinador':
            case 'administrativo':
            case 'gerencia':
            case 'superusuario':
                return this.getAdminDashboard(rlsContext);
            default:
                return this.getAdminDashboard(rlsContext);
        }
    }

    // ==================== DASHBOARD VIGILANTE ====================

    private async getVigilanteDashboard(rlsContext: RlsContext): Promise<VigilanteDashboardDto> {
        const [
            misTurnosHoy,
            misTurnosEsteMes,
            horasTrabajadasMes,
            misAsistencias,
            misNovedades,
            misMinutas,
            misCapacitaciones,
            misIncidentesReportados,
            proximosTurnos,
            actividadReciente,
            turnosPorPuesto,
            horasPorMes,
        ] = await Promise.all([
            this.getMisTurnosHoy(rlsContext),
            this.getMisTurnosEsteMes(rlsContext),
            this.getHorasTrabajadasMes(rlsContext),
            this.getMisAsistenciasDetalladas(rlsContext),
            this.getMisNovedades(rlsContext),
            this.getMisMinutas(rlsContext),
            this.getMisCapacitacionesDetalladas(rlsContext),
            this.getMisIncidentesReportados(rlsContext),
            this.getProximosTurnos(rlsContext),
            this.getMiActividadReciente(rlsContext, 10),
            this.getTurnosPorPuesto(rlsContext),
            this.getHorasPorMes(rlsContext),
        ]);

        return {
            misTurnosHoy,
            misTurnosEsteMes,
            horasTrabajadasMes,
            misAsistencias,
            misNovedades,
            misMinutas,
            misCapacitaciones,
            misIncidentesReportados,
            proximosTurnos,
            actividadReciente,
            turnosPorPuesto,
            horasPorMes,
        };
    }

    // Métodos auxiliares para Vigilante
    private async getMisTurnosHoy(rlsContext: RlsContext): Promise<OverviewMetricDto> {
        const supabase = this.supabaseService.getClient();
        const today = new Date().toISOString().split('T')[0];

        const { count } = await supabase
            .from('turnos')
            .select('*', { count: 'exact', head: true })
            .eq('empleado_id', rlsContext.empleadoId)
            .eq('fecha', today);

        return {
            value: count || 0,
            change: 0,
            trend: 'neutral',
            label: 'Mis Turnos Hoy',
        };
    }

    private async getMisTurnosEsteMes(rlsContext: RlsContext): Promise<OverviewMetricDto> {
        const supabase = this.supabaseService.getClient();
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

        const { count } = await supabase
            .from('turnos')
            .select('*', { count: 'exact', head: true })
            .eq('empleado_id', rlsContext.empleadoId)
            .gte('fecha', firstDay)
            .lte('fecha', lastDay);

        return {
            value: count || 0,
            change: 0,
            trend: 'neutral',
            label: 'Turnos Este Mes',
        };
    }

    private async getHorasTrabajadasMes(rlsContext: RlsContext): Promise<OverviewMetricDto> {
        const supabase = this.supabaseService.getClient();
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

        const { data } = await supabase
            .from('turnos')
            .select('duracion_horas')
            .eq('empleado_id', rlsContext.empleadoId)
            .gte('fecha', firstDay)
            .eq('estado_turno', 'cumplido');

        const totalHoras = data?.reduce((sum, t) => sum + (parseFloat(t.duracion_horas) || 8), 0) || 0;

        return {
            value: Math.round(totalHoras),
            change: 0,
            trend: 'neutral',
            label: 'Horas Trabajadas Este Mes',
        };
    }

    private async getMisAsistenciasDetalladas(rlsContext: RlsContext): Promise<AsistenciaStatsDto> {
        const supabase = this.supabaseService.getClient();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: turnos } = await supabase
            .from('turnos')
            .select('id, hora_inicio')
            .eq('empleado_id', rlsContext.empleadoId)
            .gte('fecha', thirtyDaysAgo.toISOString().split('T')[0]);

        const turnoIds = turnos?.map(t => t.id) || [];

        const { data: asistencias } = await supabase
            .from('turnos_asistencia')
            .select('turno_id, hora_entrada, estado_asistencia')
            .in('turno_id', turnoIds);

        const totalTurnos = turnos?.length || 0;
        const totalAsistencias = asistencias?.length || 0;
        const cumplidas = asistencias?.filter(a => a.estado_asistencia === 'cumplido').length || 0;
        const faltas = totalTurnos - totalAsistencias;

        return {
            totalAsistencias,
            asistenciasPuntuales: cumplidas,
            asistenciasTardias: totalAsistencias - cumplidas,
            faltas,
            porcentajePuntualidad: totalAsistencias > 0 ? (cumplidas / totalAsistencias) * 100 : 0,
            porcentajeAsistencia: totalTurnos > 0 ? (totalAsistencias / totalTurnos) * 100 : 0,
        };
    }

    private async getMisNovedades(rlsContext: RlsContext): Promise<OverviewMetricDto> {
        const supabase = this.supabaseService.getClient();

        const { count } = await supabase
            .from('novedades')
            .select('*', { count: 'exact', head: true })
            .eq('creada_por', rlsContext.userId);

        return {
            value: count || 0,
            change: 0,
            trend: 'neutral',
            label: 'Novedades Reportadas',
        };
    }

    private async getMisMinutas(rlsContext: RlsContext): Promise<OverviewMetricDto> {
        const supabase = this.supabaseService.getClient();

        const { count } = await supabase
            .from('minutas')
            .select('*', { count: 'exact', head: true })
            .eq('creada_por', rlsContext.userId);

        return {
            value: count || 0,
            change: 0,
            trend: 'neutral',
            label: 'Minutas Creadas',
        };
    }

    private async getMisCapacitacionesDetalladas(rlsContext: RlsContext): Promise<CapacitacionesStatsDto> {
        const supabase = this.supabaseService.getClient();

        const { data } = await supabase
            .from('empleado_capacitaciones')
            .select('aprobado, fecha_vencimiento')
            .eq('empleado_id', rlsContext.empleadoId);

        const total = data?.length || 0;
        const aprobadas = data?.filter(c => c.aprobado).length || 0;
        const vencidas = data?.filter(c => c.fecha_vencimiento && new Date(c.fecha_vencimiento) < new Date()).length || 0;
        const pendientes = total - aprobadas - vencidas;

        return {
            totalCapacitaciones: total,
            capacitacionesAprobadas: aprobadas,
            capacitacionesPendientes: pendientes,
            capacitacionesVencidas: vencidas,
            porcentajeAprobacion: total > 0 ? (aprobadas / total) * 100 : 0,
        };
    }

    private async getMisIncidentesReportados(rlsContext: RlsContext): Promise<OverviewMetricDto> {
        const supabase = this.supabaseService.getClient();

        const { count } = await supabase
            .from('incidentes')
            .select('*', { count: 'exact', head: true })
            .eq('empleado_reporta', rlsContext.empleadoId);

        return {
            value: count || 0,
            change: 0,
            trend: 'neutral',
            label: 'Incidentes Reportados',
        };
    }

    private async getProximosTurnos(rlsContext: RlsContext): Promise<TurnoDetailDto[]> {
        const supabase = this.supabaseService.getClient();
        const today = new Date().toISOString().split('T')[0];

        const { data } = await supabase
            .from('turnos')
            .select('id, fecha, hora_inicio, hora_fin, tipo_turno, estado_turno, puesto_id, puestos_trabajo(nombre)')
            .eq('empleado_id', rlsContext.empleadoId)
            .gte('fecha', today)
            .order('fecha', { ascending: true })
            .limit(5);

        return data?.map(t => ({
            id: t.id,
            fecha: t.fecha,
            horaInicio: t.hora_inicio || '',
            horaFin: t.hora_fin || '',
            tipoTurno: t.tipo_turno || '',
            puesto: (t.puestos_trabajo as any)?.nombre || 'Sin asignar',
            estado: t.estado_turno || 'programado',
        })) || [];
    }

    private async getMiActividadReciente(rlsContext: RlsContext, limit: number): Promise<RecentActivityDto[]> {
        const supabase = this.supabaseService.getClient();

        const [minutas, novedades] = await Promise.all([
            supabase
                .from('minutas')
                .select('id, tipo, titulo, created_at, nivel_riesgo, puesto_id, puestos_trabajo(nombre)')
                .eq('creada_por', rlsContext.userId)
                .order('created_at', { ascending: false })
                .limit(limit),

            supabase
                .from('novedades')
                .select('id, tipo, descripcion, created_at, nivel_alerta')
                .eq('creada_por', rlsContext.userId)
                .order('created_at', { ascending: false })
                .limit(limit),
        ]);

        const activities: RecentActivityDto[] = [];

        minutas.data?.forEach((min) => {
            activities.push({
                id: min.id,
                type: 'minuta',
                title: min.titulo || min.tipo || 'Minuta',
                timestamp: new Date(min.created_at),
                priority: this.mapRiesgoToPriority(min.nivel_riesgo),
                location: (min.puestos_trabajo as any)?.nombre,
            });
        });

        novedades.data?.forEach((nov) => {
            activities.push({
                id: nov.id,
                type: 'novedad',
                title: nov.tipo || 'Novedad',
                timestamp: new Date(nov.created_at),
                priority: this.mapAlertaToPriority(nov.nivel_alerta),
            });
        });

        return activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, limit);
    }

    private async getTurnosPorPuesto(rlsContext: RlsContext): Promise<Record<string, number>> {
        const supabase = this.supabaseService.getClient();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data } = await supabase
            .from('turnos')
            .select('puesto_id, puestos_trabajo(nombre)')
            .eq('empleado_id', rlsContext.empleadoId)
            .gte('fecha', thirtyDaysAgo.toISOString().split('T')[0]);

        const result: Record<string, number> = {};
        data?.forEach(t => {
            const nombre = (t.puestos_trabajo as any)?.nombre || 'Sin asignar';
            result[nombre] = (result[nombre] || 0) + 1;
        });

        return result;
    }

    private async getHorasPorMes(rlsContext: RlsContext): Promise<Record<string, number>> {
        const supabase = this.supabaseService.getClient();
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const { data } = await supabase
            .from('turnos')
            .select('fecha, duracion_horas')
            .eq('empleado_id', rlsContext.empleadoId)
            .gte('fecha', sixMonthsAgo.toISOString().split('T')[0])
            .eq('estado_turno', 'cumplido');

        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const result: Record<string, number> = {};

        data?.forEach(t => {
            const date = new Date(t.fecha);
            const monthName = monthNames[date.getMonth()];
            result[monthName] = (result[monthName] || 0) + (parseFloat(t.duracion_horas) || 8);
        });

        return result;
    }

    // ==================== HELPERS ====================

    private mapGravedadToPriority(gravedad: string): 'low' | 'medium' | 'high' | 'critical' {
        const map = { bajo: 'low', medio: 'medium', alto: 'high', critico: 'critical' };
        return (map[gravedad?.toLowerCase()] as any) || 'medium';
    }

    private mapAlertaToPriority(alerta: string): 'low' | 'medium' | 'high' | 'critical' {
        const map = { bajo: 'low', medio: 'medium', alto: 'high' };
        return (map[alerta?.toLowerCase()] as any) || 'medium';
    }

    private mapRiesgoToPriority(riesgo: string): 'low' | 'medium' | 'high' | 'critical' {
        const map = { bajo: 'low', medio: 'medium', alto: 'high', critico: 'critical' };
        return (map[riesgo?.toLowerCase()] as any) || 'medium';
    }



    // ==================== DASHBOARD CLIENTE ====================


    private async getClienteDashboard(rlsContext: RlsContext): Promise<ClienteDashboardDto> {
        const [
            misContratos,
            puestosActivos,
            guardasAsignados,
            guardasActivos,
            incidentes,
            minutasGeneradas,
            novedadesReportadas,
            turnosCumplidos,
            valorContratual,
            actividadReciente,
            detalleContratos,
            detallePuestos,
            cumplimientoTurnos,
            incidentesPorPuesto,
        ] = await Promise.all([
            this.getMisContratos(rlsContext),
            this.getMisPuestosActivos(rlsContext),
            this.getMisGuardasAsignados(rlsContext),
            this.getGuardasActivos(rlsContext),
            this.getIncidentesCliente(rlsContext),
            this.getMinutasGeneradas(rlsContext),
            this.getNovedadesCliente(rlsContext),
            this.getTurnosCumplidosCliente(rlsContext),
            this.getValorContratual(rlsContext, 6),
            this.getActividadCliente(rlsContext, 10),
            this.getDetalleContratos(rlsContext),
            this.getDetallePuestos(rlsContext),
            this.getCumplimientoTurnosCliente(rlsContext),
            this.getIncidentesPorPuesto(rlsContext),
        ]);

        return {
            misContratos,
            puestosActivos,
            guardasAsignados,
            guardasActivos,
            incidentes,
            minutasGeneradas,
            novedadesReportadas,
            turnosCumplidos,
            valorContratual,
            actividadReciente,
            detalleContratos,
            detallePuestos,
            cumplimientoTurnos,
            incidentesPorPuesto,
        };
    }

    // Métodos auxiliares para Cliente
    private async getMisContratos(rlsContext: RlsContext): Promise<OverviewMetricDto> {
        const supabase = this.supabaseService.getClient();

        const { count: activeCount } = await supabase
            .from('contratos')
            .select('*', { count: 'exact', head: true })
            .eq('cliente_id', rlsContext.clienteId)
            .eq('estado', true);

        const { count: totalCount } = await supabase
            .from('contratos')
            .select('*', { count: 'exact', head: true })
            .eq('cliente_id', rlsContext.clienteId);

        return {
            value: activeCount || 0,
            change: totalCount || 0,
            trend: 'neutral',
            label: `Contratos Activos (${totalCount || 0} totales)`,
        };
    }

    private async getMisPuestosActivos(rlsContext: RlsContext): Promise<OverviewMetricDto> {
        const supabase = this.supabaseService.getClient();

        const { data: contratos } = await supabase
            .from('contratos')
            .select('id')
            .eq('cliente_id', rlsContext.clienteId)
            .eq('estado', true);

        if (!contratos || contratos.length === 0) {
            return { value: 0, change: 0, trend: 'neutral', label: 'Puestos Activos' };
        }

        const { count } = await supabase
            .from('puestos_trabajo')
            .select('*', { count: 'exact', head: true })
            .in('contrato_id', contratos.map(c => c.id))
            .eq('activo', true);

        return {
            value: count || 0,
            change: 0,
            trend: 'neutral',
            label: 'Puestos Activos',
        };
    }

    private async getMisGuardasAsignados(rlsContext: RlsContext): Promise<OverviewMetricDto> {
        const supabase = this.supabaseService.getClient();

        const { data } = await supabase
            .from('contratos')
            .select('numero_guardas')
            .eq('cliente_id', rlsContext.clienteId)
            .eq('estado', true);

        const total = data?.reduce((sum, c) => sum + (c.numero_guardas || 0), 0) || 0;

        return {
            value: total,
            change: 0,
            trend: 'neutral',
            label: 'Guardas Asignados',
        };
    }

    private async getGuardasActivos(rlsContext: RlsContext): Promise<OverviewMetricDto> {
        const supabase = this.supabaseService.getClient();
        const today = new Date().toISOString().split('T')[0];

        const { data: contratos } = await supabase
            .from('contratos')
            .select('id')
            .eq('cliente_id', rlsContext.clienteId)
            .eq('estado', true);

        if (!contratos || contratos.length === 0) {
            return { value: 0, change: 0, trend: 'neutral', label: 'Guardas Activos Hoy' };
        }

        const { data: puestos } = await supabase
            .from('puestos_trabajo')
            .select('id')
            .in('contrato_id', contratos.map(c => c.id));

        if (!puestos || puestos.length === 0) {
            return { value: 0, change: 0, trend: 'neutral', label: 'Guardas Activos Hoy' };
        }

        const { count } = await supabase
            .from('turnos')
            .select('empleado_id', { count: 'exact', head: true })
            .in('puesto_id', puestos.map(p => p.id))
            .eq('fecha', today)
            .in('estado_turno', ['programado', 'cumplido']);

        return {
            value: count || 0,
            change: 0,
            trend: 'neutral',
            label: 'Guardas Activos Hoy',
        };
    }

    private async getIncidentesCliente(rlsContext: RlsContext): Promise<IncidenteStatsDto> {
        const supabase = this.supabaseService.getClient();

        const puestoIds = await this.getPuestoIdsCliente(rlsContext);
        if (puestoIds.length === 0) {
            return {
                total: 0,
                resueltos: 0,
                pendientes: 0,
                porGravedad: {},
                porTipo: {},
            };
        }

        const { data } = await supabase
            .from('incidentes')
            .select('estado, nivel_gravedad, tipo_incidente')
            .in('puesto_id', puestoIds);

        const total = data?.length || 0;
        const resueltos = data?.filter(i => i.estado === 'resuelto').length || 0;
        const pendientes = data?.filter(i => ['abierto', 'en_investigacion'].includes(i.estado)).length || 0;

        const porGravedad: Record<string, number> = {};
        const porTipo: Record<string, number> = {};

        data?.forEach(i => {
            porGravedad[i.nivel_gravedad] = (porGravedad[i.nivel_gravedad] || 0) + 1;
            porTipo[i.tipo_incidente] = (porTipo[i.tipo_incidente] || 0) + 1;
        });

        return { total, resueltos, pendientes, porGravedad, porTipo };
    }

    private async getMinutasGeneradas(rlsContext: RlsContext): Promise<OverviewMetricDto> {
        const supabase = this.supabaseService.getClient();
        const puestoIds = await this.getPuestoIdsCliente(rlsContext);

        if (puestoIds.length === 0) {
            return { value: 0, change: 0, trend: 'neutral', label: 'Minutas Generadas' };
        }

        const { count } = await supabase
            .from('minutas')
            .select('*', { count: 'exact', head: true })
            .in('puesto_id', puestoIds);

        return {
            value: count || 0,
            change: 0,
            trend: 'neutral',
            label: 'Minutas Generadas',
        };
    }

    private async getNovedadesCliente(rlsContext: RlsContext): Promise<OverviewMetricDto> {
        const supabase = this.supabaseService.getClient();
        const puestoIds = await this.getPuestoIdsCliente(rlsContext);

        if (puestoIds.length === 0) {
            return { value: 0, change: 0, trend: 'neutral', label: 'Novedades Reportadas' };
        }

        const { data: turnos } = await supabase
            .from('turnos')
            .select('id')
            .in('puesto_id', puestoIds);

        if (!turnos || turnos.length === 0) {
            return { value: 0, change: 0, trend: 'neutral', label: 'Novedades Reportadas' };
        }

        const { count } = await supabase
            .from('novedades')
            .select('*', { count: 'exact', head: true })
            .in('turno_id', turnos.map(t => t.id));

        return {
            value: count || 0,
            change: 0,
            trend: 'neutral',
            label: 'Novedades Reportadas',
        };
    }

    private async getTurnosCumplidosCliente(rlsContext: RlsContext): Promise<OverviewMetricDto> {
        const supabase = this.supabaseService.getClient();
        const puestoIds = await this.getPuestoIdsCliente(rlsContext);

        if (puestoIds.length === 0) {
            return { value: 0, change: 0, trend: 'neutral', label: 'Turnos Cumplidos' };
        }

        const { count } = await supabase
            .from('turnos')
            .select('*', { count: 'exact', head: true })
            .in('puesto_id', puestoIds)
            .eq('estado_turno', 'cumplido');

        return {
            value: count || 0,
            change: 0,
            trend: 'neutral',
            label: 'Turnos Cumplidos',
        };
    }

    private async getValorContratual(rlsContext: RlsContext, months: number): Promise<MonthlyRevenueDto[]> {
        const supabase = this.supabaseService.getClient();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - months);

        const { data } = await supabase
            .from('contratos')
            .select('fecha_inicio, valor')
            .eq('cliente_id', rlsContext.clienteId)
            .gte('fecha_inicio', startDate.toISOString())
            .order('fecha_inicio');

        return this.processMonthlyRevenue(data || []);
    }

    private async getActividadCliente(rlsContext: RlsContext, limit: number): Promise<RecentActivityDto[]> {
        const supabase = this.supabaseService.getClient();
        const puestoIds = await this.getPuestoIdsCliente(rlsContext);

        if (puestoIds.length === 0) return [];

        const [incidentes, minutas] = await Promise.all([
            supabase
                .from('incidentes')
                .select('id, tipo_incidente, nivel_gravedad, estado, fecha_reporte, puesto_id, puestos_trabajo(nombre)')
                .in('puesto_id', puestoIds)
                .order('fecha_reporte', { ascending: false })
                .limit(limit),

            supabase
                .from('minutas')
                .select('id, tipo, titulo, nivel_riesgo, created_at, puesto_id, puestos_trabajo(nombre)')
                .in('puesto_id', puestoIds)
                .order('created_at', { ascending: false })
                .limit(limit),
        ]);

        const activities: RecentActivityDto[] = [];

        incidentes.data?.forEach((inc) => {
            activities.push({
                id: inc.id,
                type: 'incident',
                title: inc.tipo_incidente || 'Incidente',
                timestamp: new Date(inc.fecha_reporte),
                priority: this.mapGravedadToPriority(inc.nivel_gravedad),
                status: inc.estado,
                location: (inc.puestos_trabajo as any)?.nombre,
            });
        });

        minutas.data?.forEach((min) => {
            activities.push({
                id: min.id,
                type: 'minuta',
                title: min.titulo || min.tipo || 'Minuta',
                timestamp: new Date(min.created_at),
                priority: this.mapRiesgoToPriority(min.nivel_riesgo),
                location: (min.puestos_trabajo as any)?.nombre,
            });
        });

        return activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, limit);
    }

    private async getDetalleContratos(rlsContext: RlsContext): Promise<ContratoDetailDto[]> {
        const supabase = this.supabaseService.getClient();

        const { data } = await supabase
            .from('contratos')
            .select('id, fecha_inicio, fecha_fin, valor, numero_guardas, estado, tipo_servicio_id, tipo_servicio(nombre)')
            .eq('cliente_id', rlsContext.clienteId)
            .order('created_at', { ascending: false });

        return data?.map(c => ({
            id: c.id,
            servicio: (c.tipo_servicio as any)?.nombre || 'Sin especificar',
            fechaInicio: c.fecha_inicio,
            fechaFin: c.fecha_fin,
            valor: parseFloat(c.valor),
            numeroGuardas: c.numero_guardas,
            activo: c.estado,
        })) || [];
    }

    private async getDetallePuestos(rlsContext: RlsContext): Promise<PuestoDetailDto[]> {
        const supabase = this.supabaseService.getClient();

        const { data: contratos } = await supabase
            .from('contratos')
            .select('id')
            .eq('cliente_id', rlsContext.clienteId);

        if (!contratos || contratos.length === 0) return [];

        const { data } = await supabase
            .from('puestos_trabajo')
            .select('id, nombre, ciudad, numero_guardas, activo')
            .in('contrato_id', contratos.map(c => c.id));

        // Obtener guardas asignados por puesto
        const puestosConAsignaciones = await Promise.all(
            (data || []).map(async (p) => {
                const { count } = await supabase
                    .from('asignacion_guardas_puesto')
                    .select('*', { count: 'exact', head: true })
                    .eq('puesto_id', p.id)
                    .eq('activo', true);

                return {
                    id: p.id,
                    nombre: p.nombre,
                    ciudad: p.ciudad,
                    numeroGuardas: p.numero_guardas,
                    guardasAsignados: count || 0,
                    activo: p.activo,
                };
            })
        );

        return puestosConAsignaciones;
    }

    private async getCumplimientoTurnosCliente(rlsContext: RlsContext): Promise<Record<string, number>> {
        const supabase = this.supabaseService.getClient();
        const puestoIds = await this.getPuestoIdsCliente(rlsContext);

        if (puestoIds.length === 0) return {};

        const { data } = await supabase
            .from('turnos')
            .select('estado_turno')
            .in('puesto_id', puestoIds);

        const result: Record<string, number> = {};
        data?.forEach(t => {
            result[t.estado_turno] = (result[t.estado_turno] || 0) + 1;
        });

        return result;
    }

    private async getIncidentesPorPuesto(rlsContext: RlsContext): Promise<Record<string, number>> {
        const supabase = this.supabaseService.getClient();
        const puestoIds = await this.getPuestoIdsCliente(rlsContext);

        if (puestoIds.length === 0) return {};

        const { data } = await supabase
            .from('incidentes')
            .select('puesto_id, puestos_trabajo(nombre)')
            .in('puesto_id', puestoIds);

        const result: Record<string, number> = {};
        data?.forEach(i => {
            const nombre = (i.puestos_trabajo as any)?.nombre || 'Sin asignar';
            result[nombre] = (result[nombre] || 0) + 1;
        });

        return result;
    }

    // Helper para obtener IDs de puestos del cliente
    private async getPuestoIdsCliente(rlsContext: RlsContext): Promise<number[]> {
        const supabase = this.supabaseService.getClient();

        const { data: contratos } = await supabase
            .from('contratos')
            .select('id')
            .eq('cliente_id', rlsContext.clienteId);

        if (!contratos || contratos.length === 0) return [];

        const { data: puestos } = await supabase
            .from('puestos_trabajo')
            .select('id')
            .in('contrato_id', contratos.map(c => c.id));

        return puestos?.map(p => p.id) || [];
    }

    // Helper para procesar ingresos mensuales
    private processMonthlyRevenue(data: any[]): MonthlyRevenueDto[] {
        const monthlyData = new Map<string, { total: number; year: number; month: number }>();
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

        data?.forEach((contract) => {
            const date = new Date(contract.fecha_inicio);
            const key = `${date.getFullYear()}-${date.getMonth()}`;

            if (!monthlyData.has(key)) {
                monthlyData.set(key, {
                    total: 0,
                    year: date.getFullYear(),
                    month: date.getMonth(),
                });
            }

            const current = monthlyData.get(key);
            if (current) {
                current.total += parseFloat(contract.valor) || 0;
            }
        });

        return Array.from(monthlyData.values())
            .map((item) => ({
                month: monthNames[item.month],
                value: Math.round(item.total / 1000),
                year: item.year,
            }))
            .sort((a, b) => {
                if (a.year !== b.year) return a.year - b.year;
                return monthNames.indexOf(a.month) - monthNames.indexOf(b.month);
            });
    }


    // ==================== DASHBOARD SUPERVISOR (SIN FINANZAS) ====================

    private async getSupervisorDashboard(rlsContext: RlsContext): Promise<SupervisorDashboardDto> {
        const [
            puestosAsignados,
            empleadosSupervision,
            turnosHoy,
            misRecorridos,
            incidentes,
            novedadesReportadas,
            minutasRevisadas,
            asistenciaEmpleados,
            actividadReciente,
            detallePuestos,
            cumplimientoTurnos,
            turnosPorMes,
        ] = await Promise.all([
            this.getPuestosAsignadosSupervisor(rlsContext),
            this.getEmpleadosSupervision(rlsContext),
            this.getTurnosHoySupervisor(rlsContext),
            this.getRecorridosSupervisor(rlsContext),
            this.getIncidentesSupervisor(rlsContext),
            this.getNovedadesSupervisor(rlsContext),
            this.getMinutasRevisadas(rlsContext),
            this.getAsistenciaEmpleados(rlsContext),
            this.getActividadSupervisor(rlsContext, 10),
            this.getDetallePuestosSupervisor(rlsContext),
            this.getCumplimientoTurnosSupervisor(rlsContext),
            this.getTurnosPorMesSupervisor(rlsContext),
        ]);

        return {
            puestosAsignados,
            empleadosSupervision,
            turnosHoy,
            misRecorridos,
            incidentes,
            novedadesReportadas,
            minutasRevisadas,
            asistenciaEmpleados,
            actividadReciente,
            detallePuestos,
            cumplimientoTurnos,
            turnosPorMes,
        };
    }

    // Métodos auxiliares para Supervisor
    private async getPuestosAsignadosSupervisor(rlsContext: RlsContext): Promise<OverviewMetricDto> {
        const supabase = this.supabaseService.getClient();

        // Asumiendo que hay una relación supervisor-puesto
        const { count } = await supabase
            .from('puestos_trabajo')
            .select('*', { count: 'exact', head: true })
            .eq('activo', true);

        return {
            value: count || 0,
            change: 0,
            trend: 'neutral',
            label: 'Puestos Asignados',
        };
    }

    private async getEmpleadosSupervision(rlsContext: RlsContext): Promise<OverviewMetricDto> {
        const supabase = this.supabaseService.getClient();

        const { count } = await supabase
            .from('empleados')
            .select('*', { count: 'exact', head: true })
            .eq('activo', true);

        return {
            value: count || 0,
            change: 0,
            trend: 'neutral',
            label: 'Empleados en Supervisión',
        };
    }

    private async getTurnosHoySupervisor(rlsContext: RlsContext): Promise<OverviewMetricDto> {
        const supabase = this.supabaseService.getClient();
        const today = new Date().toISOString().split('T')[0];

        const { count } = await supabase
            .from('turnos')
            .select('*', { count: 'exact', head: true })
            .eq('fecha', today);

        return {
            value: count || 0,
            change: 0,
            trend: 'neutral',
            label: 'Turnos Hoy',
        };
    }

    private async getRecorridosSupervisor(rlsContext: RlsContext): Promise<SupervisionStatsDto> {
        const supabase = this.supabaseService.getClient();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data } = await supabase
            .from('recorridos_supervisor')
            .select('id, validado, puesto_id, puestos_trabajo(nombre)')
            .eq('supervisor_id', rlsContext.userId)
            .gte('fecha', thirtyDaysAgo.toISOString().split('T')[0]);

        const total = data?.length || 0;
        const completados = data?.filter(r => r.validado).length || 0;

        const recorridosPorPuesto: Record<string, number> = {};
        data?.forEach(r => {
            const nombre = (r.puestos_trabajo as any)?.nombre || 'Sin asignar';
            recorridosPorPuesto[nombre] = (recorridosPorPuesto[nombre] || 0) + 1;
        });

        return {
            totalRecorridos: total,
            recorridosCompletados: completados,
            porcentajeCumplimiento: total > 0 ? (completados / total) * 100 : 0,
            recorridosPorPuesto,
        };
    }

    private async getIncidentesSupervisor(rlsContext: RlsContext): Promise<IncidenteStatsDto> {
        const supabase = this.supabaseService.getClient();

        const { data } = await supabase
            .from('incidentes')
            .select('estado, nivel_gravedad, tipo_incidente')
            .order('created_at', { ascending: false })
            .limit(100);

        const total = data?.length || 0;
        const resueltos = data?.filter(i => i.estado === 'resuelto').length || 0;
        const pendientes = data?.filter(i => ['abierto', 'en_investigacion'].includes(i.estado)).length || 0;

        const porGravedad: Record<string, number> = {};
        const porTipo: Record<string, number> = {};

        data?.forEach(i => {
            porGravedad[i.nivel_gravedad] = (porGravedad[i.nivel_gravedad] || 0) + 1;
            porTipo[i.tipo_incidente] = (porTipo[i.tipo_incidente] || 0) + 1;
        });

        return { total, resueltos, pendientes, porGravedad, porTipo };
    }

    private async getNovedadesSupervisor(rlsContext: RlsContext): Promise<OverviewMetricDto> {
        const supabase = this.supabaseService.getClient();

        const { count } = await supabase
            .from('novedades')
            .select('*', { count: 'exact', head: true })
            .in('nivel_alerta', ['medio', 'alto']);

        return {
            value: count || 0,
            change: 0,
            trend: 'neutral',
            label: 'Novedades Reportadas',
        };
    }

    private async getMinutasRevisadas(rlsContext: RlsContext): Promise<OverviewMetricDto> {
        const supabase = this.supabaseService.getClient();

        const { count } = await supabase
            .from('minutas')
            .select('*', { count: 'exact', head: true })
            .eq('validado', true)
            .eq('validado_por', rlsContext.userId);

        return {
            value: count || 0,
            change: 0,
            trend: 'neutral',
            label: 'Minutas Revisadas',
        };
    }

    private async getAsistenciaEmpleados(rlsContext: RlsContext): Promise<OverviewMetricDto> {
        const supabase = this.supabaseService.getClient();
        const today = new Date().toISOString().split('T')[0];

        const { count: totalTurnos } = await supabase
            .from('turnos')
            .select('*', { count: 'exact', head: true })
            .eq('fecha', today);

        const { count: asistencias } = await supabase
            .from('turnos_asistencia')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', today);

        const porcentaje = (totalTurnos || 0) > 0 ? ((asistencias || 0) / (totalTurnos || 1)) * 100 : 0;

        return {
            value: Math.round(porcentaje),
            change: asistencias || 0,
            trend: porcentaje >= 90 ? 'up' : 'down',
            label: `Asistencia (${asistencias || 0}/${totalTurnos || 0})`,
        };
    }

    private async getActividadSupervisor(rlsContext: RlsContext, limit: number): Promise<RecentActivityDto[]> {
        const supabase = this.supabaseService.getClient();

        const [incidentes, novedades] = await Promise.all([
            supabase
                .from('incidentes')
                .select('id, tipo_incidente, nivel_gravedad, estado, fecha_reporte, puesto_id, puestos_trabajo(nombre)')
                .order('fecha_reporte', { ascending: false })
                .limit(limit),

            supabase
                .from('novedades')
                .select('id, tipo, nivel_alerta, created_at')
                .order('created_at', { ascending: false })
                .limit(limit),
        ]);

        const activities: RecentActivityDto[] = [];

        incidentes.data?.forEach((inc) => {
            activities.push({
                id: inc.id,
                type: 'incident',
                title: inc.tipo_incidente || 'Incidente',
                timestamp: new Date(inc.fecha_reporte),
                priority: this.mapGravedadToPriority(inc.nivel_gravedad),
                status: inc.estado,
                location: (inc.puestos_trabajo as any)?.nombre,
            });
        });

        novedades.data?.forEach((nov) => {
            activities.push({
                id: nov.id,
                type: 'novedad',
                title: nov.tipo || 'Novedad',
                timestamp: new Date(nov.created_at),
                priority: this.mapAlertaToPriority(nov.nivel_alerta),
            });
        });

        return activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, limit);
    }

    private async getDetallePuestosSupervisor(rlsContext: RlsContext): Promise<PuestoDetailDto[]> {
        const supabase = this.supabaseService.getClient();

        const { data } = await supabase
            .from('puestos_trabajo')
            .select('id, nombre, ciudad, numero_guardas, activo')
            .eq('activo', true)
            .limit(20);

        const puestosConAsignaciones = await Promise.all(
            (data || []).map(async (p) => {
                const { count } = await supabase
                    .from('asignacion_guardas_puesto')
                    .select('*', { count: 'exact', head: true })
                    .eq('puesto_id', p.id)
                    .eq('activo', true);

                return {
                    id: p.id,
                    nombre: p.nombre,
                    ciudad: p.ciudad,
                    numeroGuardas: p.numero_guardas,
                    guardasAsignados: count || 0,
                    activo: p.activo,
                };
            })
        );

        return puestosConAsignaciones;
    }

    private async getCumplimientoTurnosSupervisor(rlsContext: RlsContext): Promise<Record<string, number>> {
        const supabase = this.supabaseService.getClient();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data } = await supabase
            .from('turnos')
            .select('estado_turno')
            .gte('fecha', thirtyDaysAgo.toISOString().split('T')[0]);

        const result: Record<string, number> = {};
        data?.forEach(t => {
            result[t.estado_turno] = (result[t.estado_turno] || 0) + 1;
        });

        return result;
    }

    private async getTurnosPorMesSupervisor(rlsContext: RlsContext): Promise<Record<string, number>> {
        const supabase = this.supabaseService.getClient();
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const { data } = await supabase
            .from('turnos')
            .select('fecha')
            .gte('fecha', sixMonthsAgo.toISOString().split('T')[0]);

        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const result: Record<string, number> = {};

        data?.forEach(t => {
            const date = new Date(t.fecha);
            const monthName = monthNames[date.getMonth()];
            result[monthName] = (result[monthName] || 0) + 1;
        });

        return result;
    }

    // ==================== DASHBOARD ADMIN (CON FINANZAS) ====================

    private async getAdminDashboard(rlsContext: RlsContext): Promise<AdminDashboardDto> {
        const [
            totalContratos,
            empleados,
            totalClientes,
            totalPuestos,
            finanzas,
            turnosActivos,
            tareasPendientes,
            reportesGenerados,
            incidentes,
            novedadesAbiertas,
            capacitacionesPendientes,
            tendenciaIngresos,
            actividadReciente,
            contratosPorServicio,
            cumplimientoTurnos,
            ingresosPorCliente,
            turnosPorMes,
            empleadosPorMes,
        ] = await Promise.all([
            this.getTotalContratos(),
            this.getEmpleadosDetallados(),
            this.getTotalClientes(),
            this.getTotalPuestos(),
            this.getFinanzasResumen(),
            this.getTurnosActivos(),
            this.getTareasPendientes(),
            this.getReportesGenerados(),
            this.getIncidentesAdmin(),
            this.getNovedadesAbiertas(),
            this.getCapacitacionesPendientes(),
            this.getTendenciaIngresos(6),
            this.getActividadReciente(10),
            this.getContratosPorServicio(),
            this.getCumplimientoTurnosAdmin(),
            this.getIngresosPorCliente(),
            this.getTurnosPorMesAdmin(),
            this.getEmpleadosPorMes(),
        ]);

        return {
            totalContratos,
            empleados,
            totalClientes,
            totalPuestos,
            finanzas,
            turnosActivos,
            tareasPendientes,
            reportesGenerados,
            incidentes,
            novedadesAbiertas,
            capacitacionesPendientes,
            tendenciaIngresos,
            actividadReciente,
            contratosPorServicio,
            cumplimientoTurnos,
            ingresosPorCliente,
            turnosPorMes,
            empleadosPorMes,
        };
    }

    // Métodos auxiliares para Admin
    private async getTotalContratos(): Promise<OverviewMetricDto> {
        const supabase = this.supabaseService.getClient();

        const { count: activeCount } = await supabase
            .from('contratos')
            .select('*', { count: 'exact', head: true })
            .eq('estado', true);

        const { count: totalCount } = await supabase
            .from('contratos')
            .select('*', { count: 'exact', head: true });

        return {
            value: activeCount || 0,
            change: totalCount || 0,
            trend: 'neutral',
            label: `Contratos Activos (${totalCount || 0} totales)`,
        };
    }

    private async getEmpleadosDetallados(): Promise<EmpleadosStatsDto> {
        const supabase = this.supabaseService.getClient();

        const { data } = await supabase
            .from('empleados')
            .select('activo, asignado, ciudad');

        const total = data?.length || 0;
        const activos = data?.filter(e => e.activo).length || 0;
        const inactivos = total - activos;
        const asignados = data?.filter(e => e.asignado).length || 0;
        const sinAsignar = activos - asignados;

        const porCiudad: Record<string, number> = {};
        data?.forEach(e => {
            if (e.ciudad) {
                porCiudad[e.ciudad] = (porCiudad[e.ciudad] || 0) + 1;
            }
        });

        return {
            total,
            activos,
            inactivos,
            asignados,
            sinAsignar,
            porCiudad,
        };
    }

    private async getTotalClientes(): Promise<OverviewMetricDto> {
        const supabase = this.supabaseService.getClient();

        const { count: activeCount } = await supabase
            .from('clientes')
            .select('*', { count: 'exact', head: true })
            .eq('activo', true);

        const { count: totalCount } = await supabase
            .from('clientes')
            .select('*', { count: 'exact', head: true });

        return {
            value: activeCount || 0,
            change: totalCount || 0,
            trend: 'neutral',
            label: `Clientes Activos (${totalCount || 0} totales)`,
        };
    }

    private async getTotalPuestos(): Promise<OverviewMetricDto> {
        const supabase = this.supabaseService.getClient();

        const { count } = await supabase
            .from('puestos_trabajo')
            .select('*', { count: 'exact', head: true })
            .eq('activo', true);

        const { data } = await supabase
            .from('puestos_trabajo')
            .select('numero_guardas')
            .eq('activo', true);

        const totalGuardas = data?.reduce((sum, p) => sum + (p.numero_guardas || 0), 0) || 0;

        return {
            value: count || 0,
            change: totalGuardas,
            trend: 'neutral',
            label: `Puestos Activos (${totalGuardas} guardas)`,
        };
    }

    private async getFinanzasResumen(): Promise<FinancialSummaryDto> {
        const supabase = this.supabaseService.getClient();

        const { data: contratos } = await supabase
            .from('contratos')
            .select('valor')
            .eq('estado', true);

        const ingresosTotales = contratos?.reduce((sum, c) => sum + (parseFloat(c.valor) || 0), 0) || 0;

        const { data: empleados } = await supabase
            .from('empleados')
            .select('salario_id, salarios(valor)')
            .eq('activo', true);

        const costosNomina = empleados?.reduce((sum, e) => {
            const salario = (e.salarios as any)?.valor || 0;
            return sum + parseFloat(salario);
        }, 0) || 0;

        const utilidadBruta = ingresosTotales - costosNomina;
        const margenUtilidad = ingresosTotales > 0 ? (utilidadBruta / ingresosTotales) * 100 : 0;

        return {
            ingresosTotales: Math.round(ingresosTotales),
            costosNomina: Math.round(costosNomina),
            utilidadBruta: Math.round(utilidadBruta),
            margenUtilidad: parseFloat(margenUtilidad.toFixed(2)),
        };
    }

    private async getTurnosActivos(): Promise<OverviewMetricDto> {
        const supabase = this.supabaseService.getClient();
        const today = new Date().toISOString().split('T')[0];

        const { count } = await supabase
            .from('turnos')
            .select('*', { count: 'exact', head: true })
            .eq('fecha', today)
            .in('estado_turno', ['programado', 'cumplido']);

        return {
            value: count || 0,
            change: 0,
            trend: 'neutral',
            label: 'Turnos Activos Hoy',
        };
    }

    private async getTareasPendientes(): Promise<OverviewMetricDto> {
        const supabase = this.supabaseService.getClient();

        const { count: incidentes } = await supabase
            .from('incidentes')
            .select('*', { count: 'exact', head: true })
            .in('estado', ['abierto', 'en_investigacion']);

        const { count: novedades } = await supabase
            .from('novedades')
            .select('*', { count: 'exact', head: true })
            .in('nivel_alerta', ['medio', 'alto']);

        return {
            value: (incidentes || 0) + (novedades || 0),
            change: 0,
            trend: 'neutral',
            label: 'Tareas Pendientes',
        };
    }

    private async getReportesGenerados(): Promise<OverviewMetricDto> {
        const supabase = this.supabaseService.getClient();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { count } = await supabase
            .from('reportes')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', thirtyDaysAgo.toISOString());

        return {
            value: count || 0,
            change: 0,
            trend: 'neutral',
            label: 'Reportes (30 días)',
        };
    }

    private async getIncidentesAdmin(): Promise<IncidenteStatsDto> {
        const supabase = this.supabaseService.getClient();

        const { data } = await supabase
            .from('incidentes')
            .select('estado, nivel_gravedad, tipo_incidente');

        const total = data?.length || 0;
        const resueltos = data?.filter(i => i.estado === 'resuelto').length || 0;
        const pendientes = data?.filter(i => ['abierto', 'en_investigacion'].includes(i.estado)).length || 0;

        const porGravedad: Record<string, number> = {};
        const porTipo: Record<string, number> = {};

        data?.forEach(i => {
            porGravedad[i.nivel_gravedad] = (porGravedad[i.nivel_gravedad] || 0) + 1;
            porTipo[i.tipo_incidente] = (porTipo[i.tipo_incidente] || 0) + 1;
        });

        return { total, resueltos, pendientes, porGravedad, porTipo };
    }

    private async getNovedadesAbiertas(): Promise<OverviewMetricDto> {
        const supabase = this.supabaseService.getClient();

        const { count } = await supabase
            .from('novedades')
            .select('*', { count: 'exact', head: true })
            .in('nivel_alerta', ['medio', 'alto']);

        return {
            value: count || 0,
            change: 0,
            trend: 'neutral',
            label: 'Novedades Abiertas',
        };
    }

    private async getCapacitacionesPendientes(): Promise<OverviewMetricDto> {
        const supabase = this.supabaseService.getClient();

        const { count } = await supabase
            .from('empleado_capacitaciones')
            .select('*', { count: 'exact', head: true })
            .eq('aprobado', false);

        return {
            value: count || 0,
            change: 0,
            trend: 'neutral',
            label: 'Capacitaciones Pendientes',
        };
    }

    private async getTendenciaIngresos(months: number): Promise<MonthlyRevenueDto[]> {
        const supabase = this.supabaseService.getClient();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - months);

        const { data } = await supabase
            .from('contratos')
            .select('fecha_inicio, valor')
            .gte('fecha_inicio', startDate.toISOString())
            .order('fecha_inicio');

        return this.processMonthlyRevenue(data || []);
    }

    private async getActividadReciente(limit: number): Promise<RecentActivityDto[]> {
        const supabase = this.supabaseService.getClient();

        const [incidentes, novedades, minutas] = await Promise.all([
            supabase
                .from('incidentes')
                .select('id, tipo_incidente, nivel_gravedad, estado, fecha_reporte, empleado_reporta(nombre_completo)')
                .order('fecha_reporte', { ascending: false })
                .limit(limit),

            supabase
                .from('novedades')
                .select('id, tipo, nivel_alerta, created_at, creada_por(nombre_completo)')
                .order('created_at', { ascending: false })
                .limit(limit),

            supabase
                .from('minutas')
                .select('id, tipo, titulo, nivel_riesgo, created_at, creada_por(nombre_completo)')
                .order('created_at', { ascending: false })
                .limit(limit),
        ]);

        const activities: RecentActivityDto[] = [];

        incidentes.data?.forEach((inc) => {
            activities.push({
                id: inc.id,
                type: 'incident',
                title: inc.tipo_incidente || 'Incidente',
                timestamp: new Date(inc.fecha_reporte),
                priority: this.mapGravedadToPriority(inc.nivel_gravedad),
                status: inc.estado,
                createdBy: (inc.empleado_reporta as any)?.nombre_completo,
            });
        });

        novedades.data?.forEach((nov) => {
            activities.push({
                id: nov.id,
                type: 'novedad',
                title: nov.tipo || 'Novedad',
                timestamp: new Date(nov.created_at),
                priority: this.mapAlertaToPriority(nov.nivel_alerta),
                createdBy: (nov.creada_por as any)?.nombre_completo,
            });
        });

        minutas.data?.forEach((min) => {
            activities.push({
                id: min.id,
                type: 'minuta',
                title: min.titulo || min.tipo || 'Minuta',
                timestamp: new Date(min.created_at),
                priority: this.mapRiesgoToPriority(min.nivel_riesgo),
                createdBy: (min.creada_por as any)?.nombre_completo,
            });
        });

        return activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, limit);
    }

    private async getContratosPorServicio(): Promise<Record<string, number>> {
        const supabase = this.supabaseService.getClient();

        const { data } = await supabase
            .from('contratos')
            .select('tipo_servicio_id, tipo_servicio(nombre)')
            .eq('estado', true);

        const result: Record<string, number> = {};
        data?.forEach(c => {
            const nombre = (c.tipo_servicio as any)?.nombre || 'Sin especificar';
            result[nombre] = (result[nombre] || 0) + 1;
        });

        return result;
    }

    private async getCumplimientoTurnosAdmin(): Promise<Record<string, number>> {
        const supabase = this.supabaseService.getClient();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data } = await supabase
            .from('turnos')
            .select('estado_turno')
            .gte('fecha', thirtyDaysAgo.toISOString().split('T')[0]);

        const result: Record<string, number> = {};
        data?.forEach(t => {
            result[t.estado_turno] = (result[t.estado_turno] || 0) + 1;
        });

        return result;
    }

    private async getIngresosPorCliente(): Promise<Record<string, number>> {
        const supabase = this.supabaseService.getClient();

        const { data } = await supabase
            .from('contratos')
            .select('cliente_id, valor, clientes(nombre_empresa)')
            .eq('estado', true);

        const result: Record<string, number> = {};
        data?.forEach(c => {
            const nombre = (c.clientes as any)?.nombre_empresa || 'Sin especificar';
            result[nombre] = (result[nombre] || 0) + parseFloat(c.valor);
        });

        return result;
    }

    private async getTurnosPorMesAdmin(): Promise<Record<string, number>> {
        const supabase = this.supabaseService.getClient();
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const { data } = await supabase
            .from('turnos')
            .select('fecha')
            .gte('fecha', sixMonthsAgo.toISOString().split('T')[0]);

        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const result: Record<string, number> = {};

        data?.forEach(t => {
            const date = new Date(t.fecha);
            const monthName = monthNames[date.getMonth()];
            result[monthName] = (result[monthName] || 0) + 1;
        });

        return result;
    }

    private async getEmpleadosPorMes(): Promise<Record<string, number>> {
        const supabase = this.supabaseService.getClient();
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const { data } = await supabase
            .from('empleados')
            .select('created_at')
            .gte('created_at', sixMonthsAgo.toISOString());

        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const result: Record<string, number> = {};

        // Inicializar todos los meses
        monthNames.forEach(month => {
            result[month] = 0;
        });

        data?.forEach(e => {
            const date = new Date(e.created_at);
            const monthName = monthNames[date.getMonth()];
            result[monthName] = (result[monthName] || 0) + 1;
        });

        return result;
    }

}
