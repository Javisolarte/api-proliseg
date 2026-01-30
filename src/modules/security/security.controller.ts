import { Controller, Get, Post, Delete, Param, Body, Query, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SecurityService } from './security.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import type { BloquearUsuarioDto } from './dto/security.dto';

@ApiTags('Security')
@Controller('api/security')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class SecurityController {
    constructor(private readonly securityService: SecurityService) { }

    // BLOQUE 7 - User Blocking
    @Post('usuarios/:id/bloquear')
    @RequirePermissions('usuarios', 'bloquear')
    @ApiOperation({ summary: 'Bloquear usuario' })
    async bloquearUsuario(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: BloquearUsuarioDto
    ) {
        return this.securityService.bloquearUsuario(id, dto.motivo, dto.dias);
    }

    @Post('usuarios/:id/desbloquear')
    @RequirePermissions('usuarios', 'desbloquear')
    @ApiOperation({ summary: 'Desbloquear usuario' })
    async desbloquearUsuario(@Param('id', ParseIntPipe) id: number) {
        return this.securityService.desbloquearUsuario(id);
    }

    // BLOQUE 7 - Session Management
    @Get('sesiones')
    @RequirePermissions('security', 'ver_sesiones')
    @ApiOperation({ summary: 'Listar sesiones activas' })
    async listarSesiones(@Query('usuario_id') usuarioId?: number) {
        return this.securityService.listarSesionesActivas(usuarioId);
    }

    @Delete('sesiones/:id')
    @RequirePermissions('security', 'cerrar_sesiones')
    @ApiOperation({ summary: 'Cerrar sesión específica' })
    async cerrarSesion(@Param('id') id: string) {
        return this.securityService.cerrarSesion(id);
    }

    @Delete('sesiones/usuario/:id/todas')
    @RequirePermissions('security', 'cerrar_sesiones')
    @ApiOperation({ summary: 'Cerrar todas las sesiones de un usuario' })
    async cerrarTodasSesiones(@Param('id', ParseIntPipe) id: number) {
        return this.securityService.cerrarTodasSesionesUsuario(id);
    }
}
