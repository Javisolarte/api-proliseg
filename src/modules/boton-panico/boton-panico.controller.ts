import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Ip } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BotonPanicoService } from './boton-panico.service';
import { ActivarPanicoDto, AtenderPanicoDto, FilterPanicoDto } from './dto/boton-panico.dto';

@ApiTags('Botón de Pánico')
@Controller('boton-panico')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class BotonPanicoController {
    constructor(private readonly service: BotonPanicoService) { }

    @Post()
    @ApiOperation({ summary: '1. Activar Botón de Pánico (CRÍTICO)' })
    async activar(@Body() dto: ActivarPanicoDto, @Ip() ip: string) {
        return this.service.activar(dto, ip);
    }

    @Get('activos')
    @ApiOperation({ summary: '2. Listar Botones de Pánico Activos' })
    @ApiQuery({ name: 'puesto_id', required: false })
    @ApiQuery({ name: 'origen', required: false, enum: ['empleado', 'cliente'] })
    async getActivos(
        @Query('puesto_id') puestoId?: number,
        @Query('origen') origen?: string,
    ) {
        return this.service.getActivos(puestoId, origen);
    }

    @Get('historial')
    @ApiOperation({ summary: '7. Historial de Botones de Pánico' })
    async getHistorial(@Query() filters: FilterPanicoDto) {
        return this.service.getHistorial(filters);
    }

    @Get('metricas')
    @ApiOperation({ summary: '8. Métricas Operativas' })
    async getMetricas() {
        return this.service.getMetricas();
    }

    @Get(':id')
    @ApiOperation({ summary: '3. Obtener Detalle de un Evento' })
    async getDetalle(@Param('id') id: number) {
        return this.service.getDetalle(id);
    }

    @Put(':id/atender')
    @ApiOperation({ summary: '4. Atender Botón de Pánico' })
    async atender(@Param('id') id: number, @Body() dto: AtenderPanicoDto) {
        return this.service.atender(id, dto);
    }

    @Put(':id/falso')
    @ApiOperation({ summary: '5. Marcar como Falsa Alarma' })
    async marcarFalso(@Param('id') id: number) {
        return this.service.marcarFalso(id);
    }

    @Put(':id/cerrar')
    @ApiOperation({ summary: '6. Cerrar Evento' })
    async cerrar(@Param('id') id: number) {
        return this.service.cerrar(id);
    }
}
