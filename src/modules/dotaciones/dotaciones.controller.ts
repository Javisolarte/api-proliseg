import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DotacionesService } from './dotaciones.service';
import { CreateDotacionEmpleadoDto } from './dto/dotacion.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
// import { User } from '../usuarios/entities/user.entity';
// import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Dotaciones')
@Controller('dotaciones')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth('JWT-auth')
export class DotacionesController {
    constructor(private readonly dotacionesService: DotacionesService) { }

    // --- ENTREGAS ---

    @Get('entregas')
    // @RequirePermissions('dotacion.read')
    @ApiOperation({ summary: 'Listar historial de entregas de dotación' })
    @ApiResponse({ status: 200, description: 'Lista de entregas' })
    async findAllEntregas() {
        return this.dotacionesService.findAllEntregas();
    }

    @Get('entregas/empleado/:id')
    // @RequirePermissions('dotacion.read')
    @ApiOperation({ summary: 'Obtener entregas por empleado' })
    @ApiResponse({ status: 200, description: 'Lista de entregas del empleado' })
    async findEntregasByEmpleado(@Param('id') id: string) {
        return this.dotacionesService.findEntregasByEmpleado(Number(id));
    }

    @Post('entregas')
    // @RequirePermissions('dotacion.create')
    @ApiOperation({ summary: 'Registrar nueva entrega de dotación (Reduce Stock y crea Movimiento)' })
    @ApiResponse({ status: 201, description: 'Entrega registrada exitosamente' })
    async registrarEntrega(@Body() createDto: CreateDotacionEmpleadoDto, @Request() req) {
        // Override entregado_por with the logged in user ID if not provided (or force it)
        // Assuming req.user has user_id or similar. The DTO expects 'entregado_por' (integer id of usuarios_externos)
        // For now we assume the frontend sends the correct ID or we extract it if mapped.
        // Ideally: createDto.entregado_por = req.user.id; 
        return this.dotacionesService.registrarEntrega(createDto);
    }

    // --- PROGRAMACION ---

    @Get('programacion')
    // @RequirePermissions('dotacion.read')
    @ApiOperation({ summary: 'Listar programación de dotaciones (alertas, vencimientos)' })
    @ApiResponse({ status: 200, description: 'Lista de programación' })
    async findAllProgramacion() {
        return this.dotacionesService.findAllProgramacion();
    }
}
