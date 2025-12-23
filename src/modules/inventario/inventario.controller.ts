import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { InventarioService } from './inventario.service';
import { CreateInventarioDocumentoDto, CreateInventarioMovimientoDto } from './dto/inventario.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
// import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Inventario')
@Controller('inventario')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth('JWT-auth')
export class InventarioController {
    constructor(private readonly inventarioService: InventarioService) { }

    // --- DOCUMENTOS ---

    @Get('documentos')
    // @RequirePermissions('inventario.read')
    @ApiOperation({ summary: 'Listar documentos de inventario' })
    @ApiResponse({ status: 200, description: 'Lista de documentos' })
    async findAllDocumentos() {
        return this.inventarioService.findAllDocumentos();
    }

    @Get('documentos/:id')
    // @RequirePermissions('inventario.read')
    @ApiOperation({ summary: 'Obtener documento por ID' })
    @ApiResponse({ status: 200, description: 'Documento encontrado' })
    async findOneDocumento(@Param('id') id: string) {
        return this.inventarioService.findOneDocumento(Number(id));
    }

    @Post('documentos')
    // @RequirePermissions('inventario.create')
    @ApiOperation({ summary: 'Registrar documento de inventario (compra, remisión)' })
    @ApiResponse({ status: 201, description: 'Documento registrado exitosamente' })
    async createDocumento(@Body() createDto: CreateInventarioDocumentoDto) {
        return this.inventarioService.createDocumento(createDto);
    }

    // --- MOVIMIENTOS ---

    @Get('movimientos')
    // @RequirePermissions('inventario.read')
    @ApiOperation({ summary: 'Listar movimientos de inventario' })
    @ApiResponse({ status: 200, description: 'Lista de movimientos' })
    async findAllMovimientos() {
        return this.inventarioService.findAllMovimientos();
    }

    @Post('movimientos')
    // @RequirePermissions('inventario.create')
    @ApiOperation({ summary: 'Registrar movimiento de inventario (Entrada/Salida/Ajuste)' })
    @ApiResponse({ status: 201, description: 'Movimiento registrado exitosamente' })
    async createMovimiento(@Body() createDto: CreateInventarioMovimientoDto) {
        return this.inventarioService.createMovimiento(createDto);
    }
}
