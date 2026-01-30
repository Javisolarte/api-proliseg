import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JobsService } from './jobs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Jobs')
@Controller('api/system/jobs')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class JobsController {
    constructor(private readonly jobsService: JobsService) { }

    @Get()
    @RequirePermissions('system', 'ver_jobs')
    @ApiOperation({ summary: 'Listar trabajos background' })
    async listar(
        @Query('estado') estado?: string,
        @Query('tipo') tipo?: string,
        @Query('limit') limit?: string,
    ) {
        return this.jobsService.listarJobs({
            estado,
            tipo,
            limit: limit ? parseInt(limit) : undefined,
        });
    }

    @Get('fallidos')
    @RequirePermissions('system', 'ver_jobs')
    @ApiOperation({ summary: 'Listar trabajos fallidos' })
    async listarFallidos() {
        return this.jobsService.listarJobs({ estado: 'failed', limit: 100 });
    }

    @Get('estadisticas')
    @RequirePermissions('system', 'ver_jobs')
    @ApiOperation({ summary: 'Obtener estadísticas de jobs' })
    async estadisticas() {
        return this.jobsService.obtenerEstadisticas();
    }

    @Get(':id')
    @RequirePermissions('system', 'ver_jobs')
    @ApiOperation({ summary: 'Obtener detalle de job' })
    async obtener(@Param('id') id: string) {
        return this.jobsService.obtenerJob(id);
    }

    @Post(':id/reintentar')
    @RequirePermissions('system', 'reintentar_jobs')
    @ApiOperation({ summary: 'Reintentar job fallido' })
    async reintentar(@Param('id') id: string) {
        return this.jobsService.reintentar(id);
    }
}
