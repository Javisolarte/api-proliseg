import { ApiProperty } from '@nestjs/swagger';

export class OverviewMetricDto {
    @ApiProperty({ example: 30200, description: 'Valor de la métrica' })
    value: number;

    @ApiProperty({ example: 30.6, description: 'Porcentaje de cambio' })
    change: number;

    @ApiProperty({ example: 'up', enum: ['up', 'down', 'neutral'] })
    trend: 'up' | 'down' | 'neutral';

    @ApiProperty({ example: 'Total de contratos activos', required: false })
    label?: string;
}

export class MonthlyRevenueDto {
    @ApiProperty({ example: 'Apr' })
    month: string;

    @ApiProperty({ example: 70 })
    value: number;

    @ApiProperty({ example: 2025 })
    year: number;
}

export class RecentActivityDto {
    @ApiProperty({ example: 1 })
    id: number;

    @ApiProperty({ example: 'incident', enum: ['incident', 'novedad', 'minuta'] })
    type: 'incident' | 'novedad' | 'minuta';

    @ApiProperty({ example: 'Reporte de seguridad' })
    title: string;

    @ApiProperty({ example: '2025-12-11T15:30:00Z' })
    timestamp: Date;

    @ApiProperty({ example: 'high', enum: ['low', 'medium', 'high', 'critical'] })
    priority: 'low' | 'medium' | 'high' | 'critical';

    @ApiProperty({ example: 'abierto', required: false })
    status?: string;

    @ApiProperty({ example: 'Juan Pérez', required: false })
    createdBy?: string;

    @ApiProperty({ example: 'Puesto Central', required: false })
    location?: string;
}

export class TurnoDetailDto {
    @ApiProperty({ example: 1 })
    id: number;

    @ApiProperty({ example: '2025-12-11' })
    fecha: string;

    @ApiProperty({ example: '06:00' })
    horaInicio: string;

    @ApiProperty({ example: '14:00' })
    horaFin: string;

    @ApiProperty({ example: 'diurno' })
    tipoTurno: string;

    @ApiProperty({ example: 'Puesto Central' })
    puesto: string;

    @ApiProperty({ example: 'cumplido' })
    estado: string;
}

export class AsistenciaStatsDto {
    @ApiProperty({ example: 28 })
    totalAsistencias: number;

    @ApiProperty({ example: 25 })
    asistenciasPuntuales: number;

    @ApiProperty({ example: 3 })
    asistenciasTardias: number;

    @ApiProperty({ example: 2 })
    faltas: number;

    @ApiProperty({ example: 89.3 })
    porcentajePuntualidad: number;

    @ApiProperty({ example: 92.9 })
    porcentajeAsistencia: number;
}

export class CapacitacionesStatsDto {
    @ApiProperty({ example: 5 })
    totalCapacitaciones: number;

    @ApiProperty({ example: 4 })
    capacitacionesAprobadas: number;

    @ApiProperty({ example: 1 })
    capacitacionesPendientes: number;

    @ApiProperty({ example: 0 })
    capacitacionesVencidas: number;

    @ApiProperty({ example: 80.0 })
    porcentajeAprobacion: number;
}

// DTO para Dashboard de Vigilante (MUY DETALLADO)
export class VigilanteDashboardDto {
    @ApiProperty({ type: OverviewMetricDto })
    misTurnosHoy: OverviewMetricDto;

    @ApiProperty({ type: OverviewMetricDto })
    misTurnosEsteMes: OverviewMetricDto;

    @ApiProperty({ type: OverviewMetricDto })
    horasTrabajadasMes: OverviewMetricDto;

    @ApiProperty({ type: AsistenciaStatsDto })
    misAsistencias: AsistenciaStatsDto;

    @ApiProperty({ type: OverviewMetricDto })
    misNovedades: OverviewMetricDto;

    @ApiProperty({ type: OverviewMetricDto })
    misMinutas: OverviewMetricDto;

    @ApiProperty({ type: CapacitacionesStatsDto })
    misCapacitaciones: CapacitacionesStatsDto;

    @ApiProperty({ type: OverviewMetricDto })
    misIncidentesReportados: OverviewMetricDto;

    @ApiProperty({ type: [TurnoDetailDto] })
    proximosTurnos: TurnoDetailDto[];

    @ApiProperty({ type: [RecentActivityDto] })
    actividadReciente: RecentActivityDto[];

    @ApiProperty({ example: { 'Puesto A': 15, 'Puesto B': 10 } })
    turnosPorPuesto: Record<string, number>;

    @ApiProperty({ example: { 'Ene': 20, 'Feb': 22, 'Mar': 25 } })
    horasPorMes: Record<string, number>;
}

export class ContratoDetailDto {
    @ApiProperty({ example: 1 })
    id: number;

    @ApiProperty({ example: 'Vigilancia 24/7' })
    servicio: string;

    @ApiProperty({ example: '2025-01-01' })
    fechaInicio: string;

    @ApiProperty({ example: '2025-12-31' })
    fechaFin: string;

    @ApiProperty({ example: 2500000 })
    valor: number;

    @ApiProperty({ example: 10 })
    numeroGuardas: number;

    @ApiProperty({ example: true })
    activo: boolean;
}

export class PuestoDetailDto {
    @ApiProperty({ example: 1 })
    id: number;

    @ApiProperty({ example: 'Puesto Central' })
    nombre: string;

    @ApiProperty({ example: 'Bogotá' })
    ciudad: string;

    @ApiProperty({ example: 5 })
    numeroGuardas: number;

    @ApiProperty({ example: 5 })
    guardasAsignados: number;

    @ApiProperty({ example: true })
    activo: boolean;
}

export class IncidenteStatsDto {
    @ApiProperty({ example: 12 })
    total: number;

    @ApiProperty({ example: 8 })
    resueltos: number;

    @ApiProperty({ example: 4 })
    pendientes: number;

    @ApiProperty({ example: { 'bajo': 5, 'medio': 4, 'alto': 2, 'critico': 1 } })
    porGravedad: Record<string, number>;

    @ApiProperty({ example: { 'Robo': 3, 'Accidente': 5, 'Otro': 4 } })
    porTipo: Record<string, number>;
}

// DTO para Dashboard de Cliente (MUY DETALLADO)
export class ClienteDashboardDto {
    @ApiProperty({ type: OverviewMetricDto })
    misContratos: OverviewMetricDto;

    @ApiProperty({ type: OverviewMetricDto })
    puestosActivos: OverviewMetricDto;

    @ApiProperty({ type: OverviewMetricDto })
    guardasAsignados: OverviewMetricDto;

    @ApiProperty({ type: OverviewMetricDto })
    guardasActivos: OverviewMetricDto;

    @ApiProperty({ type: IncidenteStatsDto })
    incidentes: IncidenteStatsDto;

    @ApiProperty({ type: OverviewMetricDto })
    minutasGeneradas: OverviewMetricDto;

    @ApiProperty({ type: OverviewMetricDto })
    novedadesReportadas: OverviewMetricDto;

    @ApiProperty({ type: OverviewMetricDto })
    turnosCumplidos: OverviewMetricDto;

    @ApiProperty({ type: [MonthlyRevenueDto] })
    valorContratual: MonthlyRevenueDto[];

    @ApiProperty({ type: [RecentActivityDto] })
    actividadReciente: RecentActivityDto[];

    @ApiProperty({ type: [ContratoDetailDto] })
    detalleContratos: ContratoDetailDto[];

    @ApiProperty({ type: [PuestoDetailDto] })
    detallePuestos: PuestoDetailDto[];

    @ApiProperty({ example: { 'cumplido': 95, 'no_cumplido': 3, 'parcial': 2 } })
    cumplimientoTurnos: Record<string, number>;

    @ApiProperty({ example: { 'Puesto A': 2, 'Puesto B': 5, 'Puesto C': 1 } })
    incidentesPorPuesto: Record<string, number>;
}

export class SupervisionStatsDto {
    @ApiProperty({ example: 25 })
    totalRecorridos: number;

    @ApiProperty({ example: 23 })
    recorridosCompletados: number;

    @ApiProperty({ example: 92.0 })
    porcentajeCumplimiento: number;

    @ApiProperty({ example: { 'Puesto A': 10, 'Puesto B': 8, 'Puesto C': 7 } })
    recorridosPorPuesto: Record<string, number>;
}

export class EmpleadosStatsDto {
    @ApiProperty({ example: 150 })
    total: number;

    @ApiProperty({ example: 145 })
    activos: number;

    @ApiProperty({ example: 5 })
    inactivos: number;

    @ApiProperty({ example: 120 })
    asignados: number;

    @ApiProperty({ example: 25 })
    sinAsignar: number;

    @ApiProperty({ example: { 'Bogotá': 80, 'Medellín': 40, 'Cali': 30 } })
    porCiudad: Record<string, number>;
}

// DTO para Dashboard de Supervisor
export class SupervisorDashboardDto {
    @ApiProperty({ type: OverviewMetricDto })
    puestosAsignados: OverviewMetricDto;

    @ApiProperty({ type: OverviewMetricDto })
    empleadosSupervision: OverviewMetricDto;

    @ApiProperty({ type: OverviewMetricDto })
    turnosHoy: OverviewMetricDto;

    @ApiProperty({ type: SupervisionStatsDto })
    misRecorridos: SupervisionStatsDto;

    @ApiProperty({ type: IncidenteStatsDto })
    incidentes: IncidenteStatsDto;

    @ApiProperty({ type: OverviewMetricDto })
    novedadesReportadas: OverviewMetricDto;

    @ApiProperty({ type: OverviewMetricDto })
    minutasRevisadas: OverviewMetricDto;

    @ApiProperty({ type: OverviewMetricDto })
    asistenciaEmpleados: OverviewMetricDto;

    @ApiProperty({ type: [RecentActivityDto] })
    actividadReciente: RecentActivityDto[];

    @ApiProperty({ type: [PuestoDetailDto] })
    detallePuestos: PuestoDetailDto[];

    @ApiProperty({ example: { 'cumplido': 280, 'no_cumplido': 8, 'parcial': 2 } })
    cumplimientoTurnos: Record<string, number>;

    @ApiProperty({ example: { 'Ene': 285, 'Feb': 290, 'Mar': 280 } })
    turnosPorMes: Record<string, number>;
}

export class FinancialSummaryDto {
    @ApiProperty({ example: 5000000 })
    ingresosTotales: number;

    @ApiProperty({ example: 3000000 })
    costosNomina: number;

    @ApiProperty({ example: 2000000 })
    utilidadBruta: number;

    @ApiProperty({ example: 40.0 })
    margenUtilidad: number;
}

// DTO para Dashboard Administrativo (Coordinador, Administrativo, Gerencia, Superusuario)
export class AdminDashboardDto {
    @ApiProperty({ type: OverviewMetricDto })
    totalContratos: OverviewMetricDto;

    @ApiProperty({ type: EmpleadosStatsDto })
    empleados: EmpleadosStatsDto;

    @ApiProperty({ type: OverviewMetricDto })
    totalClientes: OverviewMetricDto;

    @ApiProperty({ type: OverviewMetricDto })
    totalPuestos: OverviewMetricDto;

    @ApiProperty({ type: FinancialSummaryDto })
    finanzas: FinancialSummaryDto;

    @ApiProperty({ type: OverviewMetricDto })
    turnosActivos: OverviewMetricDto;

    @ApiProperty({ type: OverviewMetricDto })
    tareasPendientes: OverviewMetricDto;

    @ApiProperty({ type: OverviewMetricDto })
    reportesGenerados: OverviewMetricDto;

    @ApiProperty({ type: IncidenteStatsDto })
    incidentes: IncidenteStatsDto;

    @ApiProperty({ type: OverviewMetricDto })
    novedadesAbiertas: OverviewMetricDto;

    @ApiProperty({ type: OverviewMetricDto })
    capacitacionesPendientes: OverviewMetricDto;

    @ApiProperty({ type: [MonthlyRevenueDto] })
    tendenciaIngresos: MonthlyRevenueDto[];

    @ApiProperty({ type: [RecentActivityDto] })
    actividadReciente: RecentActivityDto[];

    @ApiProperty({ example: { 'Vigilancia': 30, 'Escoltas': 10, 'Eventos': 5 } })
    contratosPorServicio: Record<string, number>;

    @ApiProperty({ example: { 'cumplido': 950, 'no_cumplido': 30, 'parcial': 20 } })
    cumplimientoTurnos: Record<string, number>;

    @ApiProperty({ example: { 'Cliente A': 1500000, 'Cliente B': 2000000 } })
    ingresosPorCliente: Record<string, number>;

    @ApiProperty({ example: { 'Ene': 280, 'Feb': 290, 'Mar': 285 } })
    turnosPorMes: Record<string, number>;

    @ApiProperty({ example: { 'Ene': 145, 'Feb': 148, 'Mar': 150 } })
    empleadosPorMes: Record<string, number>;
}
