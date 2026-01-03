import { Controller, Get, Post, Body, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EvidenciasService } from './evidencias.service';
import { CreateEvidenciaDto } from './dto/create-evidencia.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

@ApiTags('Evidencias')
@Controller('evidencias')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class EvidenciasController {
    constructor(private readonly evidenciasService: EvidenciasService) { }

    @Post()
    @ApiOperation({ summary: 'Registrar evidencia (URL)' })
    create(@Body() dto: CreateEvidenciaDto) {
        return this.evidenciasService.create(dto);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Obtener evidencia por ID' })
    findOne(@Param('id') id: string) {
        return this.evidenciasService.findOne(+id);
    }

    @Get('checkeo/:checkeo_id')
    @ApiOperation({ summary: 'Obtener evidencias de un chequeo' })
    getByCheckeo(@Param('checkeo_id') checkeoId: string) {
        return this.evidenciasService.findByCheckeo(+checkeoId);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Eliminar evidencia' })
    remove(@Param('id') id: string) {
        return this.evidenciasService.remove(+id);
    }
}
