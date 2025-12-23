import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CategoriasDotacionService } from './categorias-dotacion.service';
import { CreateCategoriaDotacionDto, UpdateCategoriaDotacionDto } from './dto/categoria-dotacion.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
// import { RequirePermissions } from '../auth/decorators/permissions.decorator'; // Uncomment when permissions are defined

@ApiTags('Categorias Dotacion')
@Controller('categorias-dotacion')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth('JWT-auth')
export class CategoriasDotacionController {
    constructor(private readonly categoriasService: CategoriasDotacionService) { }

    @Get()
    // @RequirePermissions('dotacion.read')
    @ApiOperation({ summary: 'Listar todas las categorías de dotación' })
    @ApiResponse({ status: 200, description: 'Lista de categorías' })
    async findAll() {
        return this.categoriasService.findAll();
    }

    @Get(':id')
    // @RequirePermissions('dotacion.read')
    @ApiOperation({ summary: 'Obtener categoría por ID' })
    @ApiResponse({ status: 200, description: 'Categoría encontrada' })
    async findOne(@Param('id') id: string) {
        return this.categoriasService.findOne(Number(id));
    }

    @Post()
    // @RequirePermissions('dotacion.create')
    @ApiOperation({ summary: 'Crear nueva categoría' })
    @ApiResponse({ status: 201, description: 'Categoría creada exitosamente' })
    async create(@Body() createDto: CreateCategoriaDotacionDto) {
        return this.categoriasService.create(createDto);
    }

    @Patch(':id')
    // @RequirePermissions('dotacion.update')
    @ApiOperation({ summary: 'Actualizar categoría' })
    @ApiResponse({ status: 200, description: 'Categoría actualizada exitosamente' })
    async update(@Param('id') id: string, @Body() updateDto: UpdateCategoriaDotacionDto) {
        return this.categoriasService.update(Number(id), updateDto);
    }

    @Delete(':id')
    // @RequirePermissions('dotacion.delete')
    @ApiOperation({ summary: 'Eliminar categoría' })
    @ApiResponse({ status: 200, description: 'Categoría eliminada exitosamente' })
    async remove(@Param('id') id: string) {
        return this.categoriasService.remove(Number(id));
    }
}
