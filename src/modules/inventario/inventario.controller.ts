import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { InventarioService } from './inventario.service';
import { CreateInventarioDocumentoDto, CreateInventarioMovimientoDto } from './dto/inventario.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Inventario')
@Controller('inventario')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('inventario')
@ApiBearerAuth('JWT-auth')
export class InventarioController {
    constructor(private readonly inventarioService: InventarioService) { }

    // --- DOCUMENTOS ---

    @Get('documentos')
    @ApiOperation({ summary: 'Listar documentos de inventario' })
    @ApiResponse({ status: 200, description: 'Lista de documentos' })
    async findAllDocumentos() {
        return this.inventarioService.findAllDocumentos();
    }

    @Get('documentos/:id')
    @ApiOperation({ summary: 'Obtener documento por ID' })
    @ApiResponse({ status: 200, description: 'Documento encontrado' })
    async findOneDocumento(@Param('id') id: string) {
        return this.inventarioService.findOneDocumento(Number(id));
    }

    @Post('documentos')
    @ApiOperation({ summary: 'Registrar documento de inventario (compra, remisión)' })
    @ApiResponse({ status: 201, description: 'Documento registrado exitosamente' })
    async createDocumento(@Body() createDto: CreateInventarioDocumentoDto) {
        return this.inventarioService.createDocumento(createDto);
    }

    // --- MOVIMIENTOS ---

    @Get('movimientos')
    @ApiOperation({ summary: 'Listar movimientos de inventario' })
    @ApiResponse({ status: 200, description: 'Lista de movimientos' })
    async findAllMovimientos() {
        return this.inventarioService.findAllMovimientos();
    }

    @Post('movimientos')
    @ApiOperation({ summary: 'Registrar movimiento de inventario (Entrada/Salida/Ajuste)' })
    @ApiResponse({ status: 201, description: 'Movimiento registrado exitosamente' })
    async createMovimiento(@Body() createDto: CreateInventarioMovimientoDto) {
        return this.inventarioService.createMovimiento(createDto);
    }

    @Get('resumen-stock/:varianteId')
    @ApiOperation({ summary: 'Obtener resumen de stock estimado (Nuevo vs Segunda)' })
    @ApiResponse({ status: 200, description: 'Resumen de stock' })
    async getResumenStock(@Param('varianteId') varianteId: string) {
        return this.inventarioService.getResumenStock(Number(varianteId));
    }

    @Get('alertas')
    @ApiOperation({ summary: 'Alertas de stock bajo' })
    async getAlertas() {
        return this.inventarioService.getAlertas();
    }

    @Get('reportes/general')
    @ApiOperation({ summary: 'Reporte general de inventario' })
    async getReporteGeneral() {
        return this.inventarioService.getReporteGeneral();
    }
}
