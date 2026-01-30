import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth('JWT-auth')
export class AnalyticsController {
    constructor(private readonly analyticsService: AnalyticsService) { }

    @Get('cumplimiento-turnos')
    @RequirePermissions('bi', 'ver')
    @ApiOperation({ summary: 'Consultar cumplimiento de turnos (BI)' })
    @ApiQuery({ name: 'puesto_id', required: false })
    @ApiQuery({ name: 'fecha_inicio', required: false })
    @ApiQuery({ name: 'fecha_fin', required: false })
    async getCumplimiento(
        @Query('puesto_id') puesto_id?: string,
        @Query('fecha_inicio') fecha_inicio?: string,
        @Query('fecha_fin') fecha_fin?: string
    ) {
        return this.analyticsService.getCumplimientoTurnos({
            posto_id: puesto_id ? parseInt(puesto_id) : undefined,
            fecha_inicio,
            fecha_fin
        });
    }

    @Get('productividad')
    @RequirePermissions('bi', 'ver')
    @ApiOperation({ summary: 'Consultar horas trabajadas y productividad' })
    @ApiQuery({ name: 'empleado_id', required: false })
    @ApiQuery({ name: 'mes', required: false })
    async getProductividad(
        @Query('empleado_id') empleado_id?: string,
        @Query('mes') mes?: string
    ) {
        return this.analyticsService.getHorasTrabajadas({
            empleado_id: empleado_id ? parseInt(empleado_id) : undefined,
            mes
        });
    }

    @Get('incidentes')
    @RequirePermissions('bi', 'ver')
    @ApiOperation({ summary: 'Estadísticas de incidentes por puesto/categoría' })
    async getIncidentes(
        @Query('puesto_id') puesto_id?: string,
        @Query('categoria') categoria?: string
    ) {
        return this.analyticsService.getIncidentesStats({
            puesto_id: puesto_id ? parseInt(puesto_id) : undefined,
            categoria
        });
    }

    @Post('refresh')
    @RequirePermissions('admin')
    @ApiOperation({ summary: 'Refrescar vistas materializadas de analítica' })
    async refresh() {
        return this.analyticsService.refreshMetrics();
    }
}
