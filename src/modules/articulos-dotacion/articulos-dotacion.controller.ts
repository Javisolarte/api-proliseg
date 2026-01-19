import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ArticulosDotacionService } from './articulos-dotacion.service';
import {
    CreateArticuloDotacionDto,
    UpdateArticuloDotacionDto,
    CreateVarianteArticuloDto,
    UpdateVarianteArticuloDto,
} from './dto/articulo-dotacion.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Articulos Dotacion')
@Controller('articulos-dotacion')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth('JWT-auth')
export class ArticulosDotacionController {
    constructor(private readonly articulosService: ArticulosDotacionService) { }

    // --- ARTICULOS ---

    @Get()
    @RequirePermissions('dotaciones')
    @ApiOperation({ summary: 'Listar todos los artículos' })
    @ApiResponse({ status: 200, description: 'Lista de artículos' })
    async findAll() {
        return this.articulosService.findAll();
    }

    @Get(':id')
    @RequirePermissions('dotaciones')
    @ApiOperation({ summary: 'Obtener artículo por ID (incluye variantes y categoría)' })
    @ApiResponse({ status: 200, description: 'Artículo encontrado' })
    async findOne(@Param('id') id: string) {
        return this.articulosService.findOne(Number(id));
    }

    @Post()
    @RequirePermissions('dotaciones')
    @ApiOperation({ summary: 'Crear nuevo artículo' })
    @ApiResponse({ status: 201, description: 'Artículo creado exitosamente' })
    async create(@Body() createDto: CreateArticuloDotacionDto) {
        return this.articulosService.create(createDto);
    }

    @Patch(':id')
    @RequirePermissions('dotaciones')
    @ApiOperation({ summary: 'Actualizar artículo' })
    @ApiResponse({ status: 200, description: 'Artículo actualizado exitosamente' })
    async update(@Param('id') id: string, @Body() updateDto: UpdateArticuloDotacionDto) {
        return this.articulosService.update(Number(id), updateDto);
    }

    @Delete(':id')
    @RequirePermissions('dotaciones')
    @ApiOperation({ summary: 'Desactivar artículo' })
    @ApiResponse({ status: 200, description: 'Artículo desactivado exitosamente' })
    async remove(@Param('id') id: string) {
        return this.articulosService.remove(Number(id));
    }

    // --- VARIANTES ---

    @Get(':id/variantes')
    @RequirePermissions('dotaciones')
    @ApiOperation({ summary: 'Listar variantes de un artículo' })
    @ApiResponse({ status: 200, description: 'Lista de variantes del artículo' })
    async findVariantes(@Param('id') id: string) {
        return this.articulosService.findVariantesByArticulo(Number(id));
    }

    @Post('variantes')
    @RequirePermissions('dotaciones')
    @ApiOperation({ summary: 'Crear variante para un artículo' })
    @ApiResponse({ status: 201, description: 'Variante creada exitosamente' })
    async createVariante(@Body() createDto: CreateVarianteArticuloDto) {
        return this.articulosService.createVariante(createDto);
    }

    @Patch('variantes/:id')
    @RequirePermissions('dotaciones')
    @ApiOperation({ summary: 'Actualizar variante' })
    @ApiResponse({ status: 200, description: 'Variante actualizada exitosamente' })
    async updateVariante(@Param('id') id: string, @Body() updateDto: UpdateVarianteArticuloDto) {
        return this.articulosService.updateVariante(Number(id), updateDto);
    }
}
