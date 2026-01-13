import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { VisitasService } from './visitas.service';
import { CreateVisitaDto, CreateTipoChequeoDto, UpdateTipoChequeoDto, CreateChequeoDto, CreateTipoChequeoItemDto, UpdateTipoChequeoItemDto } from './dto/create-visita.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

@ApiTags('Visitas y Chequeos')
@Controller('visitas')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class VisitasController {
    constructor(private readonly visitasService: VisitasService) { }

    // --- Visitas ---
    @Post('visitas')
    @ApiOperation({ summary: 'Registrar visita (Llegada)' })
    registrarVisita(@Body() dto: CreateVisitaDto) {
        return this.visitasService.registrarVisita(dto);
    }

    @Get('ejecucion/:id')
    @ApiOperation({ summary: 'Listar visitas de una ejecución' })
    getVisitas(@Param('id') id: string) {
        return this.visitasService.getVisitasPorEjecucion(+id);
    }

    // --- Tipos de Chequeo ---
    @Get('checkeos-tipos')
    @ApiOperation({ summary: 'Obtener tipos de chequeo' })
    getTipos() {
        return this.visitasService.findAllTiposChequeo();
    }

    @Post('checkeos-tipos')
    @ApiOperation({ summary: 'Crear tipo de chequeo' })
    createTipo(@Body() dto: CreateTipoChequeoDto) {
        return this.visitasService.createTipoChequeo(dto);
    }

    @Put('checkeos-tipos/:id')
    @ApiOperation({ summary: 'Actualizar tipo de chequeo' })
    updateTipo(@Param('id') id: string, @Body() dto: UpdateTipoChequeoDto) {
        return this.visitasService.updateTipoChequeo(+id, dto);
    }

    @Delete('checkeos-tipos/:id')
    @ApiOperation({ summary: 'Eliminar tipo de chequeo' })
    deleteTipo(@Param('id') id: string) {
        return this.visitasService.deleteTipoChequeo(+id);
    }

    // --- Chequeos ---
    @Post('checkeos')
    @ApiOperation({ summary: 'Registrar chequeo realizado' })
    registrarChequeo(@Body() dto: CreateChequeoDto) {
        return this.visitasService.registrarChequeo(dto);
    }

    @Get('checkeos/:id')
    @ApiOperation({ summary: 'Obtener detalle de chequeo' })
    getChequeo(@Param('id') id: string) {
        return this.visitasService.getChequeo(+id);
    }

    // --- Ítems de Chequeo (Gestión Administrativa) ---

    @Get('checkpoint-items')
    @ApiOperation({ summary: 'Listar ítems de un tipo de chequeo' })
    @ApiQuery({ name: 'tipo_id', required: true })
    getItems(@Query('tipo_id') tipoId: string) {
        return this.visitasService.findItemsByTipo(+tipoId);
    }

    @Post('checkpoint-items')
    @ApiOperation({ summary: 'Crear ítem de chequeo' })
    createItem(@Body() dto: CreateTipoChequeoItemDto) {
        return this.visitasService.createItem(dto);
    }

    @Put('checkpoint-items/:id')
    @ApiOperation({ summary: 'Actualizar ítem de chequeo' })
    updateItem(@Param('id') id: string, @Body() dto: UpdateTipoChequeoItemDto) {
        return this.visitasService.updateItem(+id, dto);
    }

    @Delete('checkpoint-items/:id')
    @ApiOperation({ summary: 'Eliminar ítem de chequeo' })
    deleteItem(@Param('id') id: string) {
        return this.visitasService.deleteItem(+id);
    }
}
