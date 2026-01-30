import { Controller, Post, Body, Get, Query, UseGuards, Request, Ip, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PoliticasService } from './politicas.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CrearPoliticaDto, RegistrarConsentimientoDto } from './dto/politicas.dto';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Cumplimiento Legal')
@Controller('api/politicas')
export class PoliticasController {
    constructor(private readonly politicasService: PoliticasService) { }

    @Get('vigente')
    @ApiOperation({ summary: 'Obtener política viagente por código (ej: HABEAS_DATA)' })
    async obtenerVigente(@Query('codigo') codigo: string) {
        // Endpoint público (puede ser llamado antes de login)
        return this.politicasService.obtenerPoliticaVigente(codigo);
    }

    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('JWT-auth')
    @Get('estado')
    @ApiOperation({ summary: 'Verificar si el usuario actual ha aceptado la política vigente' })
    async verificarEstado(@Request() req, @Query('codigo') codigo: string) {
        const tipo = req.user.tipo === 'empleado' ? 'empleado' : 'usuario';
        return this.politicasService.verificarConsentimiento(req.user.id, tipo, codigo || 'HABEAS_DATA');
    }

    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('JWT-auth')
    @Post('aceptar')
    @ApiOperation({ summary: 'Registrar aceptación de política' })
    async aceptarPolitica(
        @Request() req,
        @Body() dto: RegistrarConsentimientoDto,
        @Ip() ip: string,
        @Headers('user-agent') ua: string
    ) {
        const tipo = req.user.tipo === 'empleado' ? 'empleado' : 'usuario';
        return this.politicasService.registrarConsentimiento(req.user.id, tipo, dto, { ip, ua });
    }

    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('JWT-auth')
    @Get('pendientes')
    @ApiOperation({ summary: 'Listar todas las políticas vigentes pendientes de aceptación' })
    async obtenerPendientes(@Request() req) {
        const tipo = req.user.tipo === 'empleado' ? 'empleado' : 'usuario';
        return this.politicasService.obtenerPendientes(req.user.id, tipo);
    }

    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('JWT-auth')
    @Post('revocar')
    @ApiOperation({ summary: 'Revocar consentimiento previo (Habeas Data)' })
    async revocarConsentimiento(@Request() req, @Body('politica_id') politicaId: number, @Body('motivo') motivo: string) {
        const tipo = req.user.tipo === 'empleado' ? 'empleado' : 'usuario';
        return this.politicasService.revocarConsentimiento(req.user.id, tipo, politicaId, motivo);
    }

    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('JWT-auth')
    @Post('admin/nueva-version')
    @RequirePermissions('sistema', 'admin_politicas')
    @ApiOperation({ summary: 'Crear nueva versión de política (Admin)' })
    async crearNuevaVersion(@Body() dto: CrearPoliticaDto) {
        return this.politicasService.crearNuevaVersion(dto);
    }
}
