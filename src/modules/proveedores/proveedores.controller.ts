import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ProveedoresService } from './proveedores.service';
import { CreateProveedorDto, UpdateProveedorDto } from './dto/proveedor.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
// import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Proveedores')
@Controller('proveedores')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth('JWT-auth')
export class ProveedoresController {
    constructor(private readonly proveedoresService: ProveedoresService) { }

    @Get()
    // @RequirePermissions('proveedores.read')
    @ApiOperation({ summary: 'Listar todos los proveedores' })
    @ApiResponse({ status: 200, description: 'Lista de proveedores' })
    async findAll() {
        return this.proveedoresService.findAll();
    }

    @Get(':id')
    // @RequirePermissions('proveedores.read')
    @ApiOperation({ summary: 'Obtener proveedor por ID' })
    @ApiResponse({ status: 200, description: 'Proveedor encontrado' })
    async findOne(@Param('id') id: string) {
        return this.proveedoresService.findOne(Number(id));
    }

    @Post()
    // @RequirePermissions('proveedores.create')
    @ApiOperation({ summary: 'Crear nuevo proveedor' })
    @ApiResponse({ status: 201, description: 'Proveedor creado exitosamente' })
    async create(@Body() createDto: CreateProveedorDto) {
        return this.proveedoresService.create(createDto);
    }

    @Patch(':id')
    // @RequirePermissions('proveedores.update')
    @ApiOperation({ summary: 'Actualizar proveedor' })
    @ApiResponse({ status: 200, description: 'Proveedor actualizado exitosamente' })
    async update(@Param('id') id: string, @Body() updateDto: UpdateProveedorDto) {
        return this.proveedoresService.update(Number(id), updateDto);
    }

    @Delete(':id')
    // @RequirePermissions('proveedores.delete')
    @ApiOperation({ summary: 'Desactivar proveedor' })
    @ApiResponse({ status: 200, description: 'Proveedor desactivado exitosamente' })
    async remove(@Param('id') id: string) {
        return this.proveedoresService.remove(Number(id));
    }
}
