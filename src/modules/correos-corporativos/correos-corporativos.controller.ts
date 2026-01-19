import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CorreosCorporativosService } from './correos-corporativos.service';
import { CreateCorreoDto, UpdateCorreoDto, AsignarCorreoDto, DevolverCorreoDto } from './dto/correo.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Correos Corporativos')
@Controller('correos-corporativos')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth('JWT-auth')
export class CorreosCorporativosController {
    constructor(private readonly correosService: CorreosCorporativosService) { }

    @Get()
    @RequirePermissions('correos_corporativos.read')
    @ApiOperation({ summary: 'Listar todos los correos corporativos' })
    async findAll() {
        return this.correosService.findAll();
    }

    @Get('asignaciones')
    @RequirePermissions('correos_corporativos.read')
    @ApiOperation({ summary: 'Listar historial de asignaciones' })
    @ApiQuery({ name: 'empleadoId', required: false })
    @ApiQuery({ name: 'correoId', required: false })
    async getAsignaciones(
        @Query('empleadoId') empleadoId?: number,
        @Query('correoId') correoId?: number
    ) {
        return this.correosService.getAsignaciones(correoId, empleadoId);
    }

    @Get(':id')
    @RequirePermissions('correos_corporativos.read')
    @ApiOperation({ summary: 'Obtener un correo por ID' })
    async findOne(@Param('id') id: number) {
        return this.correosService.findOne(id);
    }

    @Post()
    @RequirePermissions('correos_corporativos.create')
    @ApiOperation({ summary: 'Crear nuevo correo corporativo' })
    async create(@Body() createCorreoDto: CreateCorreoDto) {
        return this.correosService.create(createCorreoDto);
    }

    @Put(':id')
    @RequirePermissions('correos_corporativos.update')
    @ApiOperation({ summary: 'Actualizar correo corporativo' })
    async update(@Param('id') id: number, @Body() updateCorreoDto: UpdateCorreoDto) {
        return this.correosService.update(id, updateCorreoDto);
    }

    @Delete(':id')
    @RequirePermissions('correos_corporativos.delete')
    @ApiOperation({ summary: 'Eliminar (soft delete) correo corporativo' })
    async remove(@Param('id') id: number) {
        return this.correosService.remove(id);
    }

    @Post('asignar')
    @RequirePermissions('correos_corporativos.assign')
    @ApiOperation({ summary: 'Asignar correo a empleado' })
    async asignar(@Body() dto: AsignarCorreoDto) {
        return this.correosService.asignarCorreo(dto);
    }

    @Post('devolver/:asignacionId')
    @RequirePermissions('correos_corporativos.assign')
    @ApiOperation({ summary: 'Registrar devolución de correo' })
    async devolver(@Param('asignacionId') asignacionId: number, @Body() dto: DevolverCorreoDto) {
        return this.correosService.devolverCorreo(asignacionId, dto);
    }
}
