import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { BiService } from './bi.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Business Intelligence (BI)')
@Controller('api/bi')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class BiController {
    constructor(private readonly biService: BiService) { }

    @Get('kpis')
    @RequirePermissions('dashboard', 'ver_admin')
    @ApiOperation({ summary: 'Obtener KPIs generales ejecutivos' })
    async getKpis() {
        return this.biService.getKpisGenerales();
    }

    @Get('ausentismo')
    @RequirePermissions('dashboard', 'ver_admin')
    @ApiOperation({ summary: 'Métricas de ausentismo y novedades de nómina' })
    @ApiQuery({ name: 'periodo', required: false, enum: ['mes', 'semana'] })
    async getAusentismo(@Query('periodo') periodo: 'mes' | 'semana') {
        return this.biService.getAusentismo(periodo);
    }

    @Get('rondas')
    @RequirePermissions('dashboard', 'ver_admin')
    @ApiOperation({ summary: 'Métricas de cumplimiento de rondas' })
    async getRondas() {
        return this.biService.getRondasStats();
    }

    @Get('incidentes')
    @RequirePermissions('dashboard', 'ver_admin')
    @ApiOperation({ summary: 'Análisis de incidentes por tipo y severidad' })
    async getIncidentes() {
        return this.biService.getIncidentesStats();
    }
}
