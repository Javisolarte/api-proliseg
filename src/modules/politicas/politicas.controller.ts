import { Body, Controller, Get, Headers, Ip, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PoliticasService } from './politicas.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CrearPoliticaDto, RegistrarConsentimientoDto } from './dto/politicas.dto';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Cumplimiento Legal')
@Controller('politicas')
export class PoliticasController {
    constructor(private readonly politicasService: PoliticasService) { }

    @Get('vigente')
    @Public()
    @ApiOperation({ summary: 'Obtener politica vigente por codigo' })
    async obtenerVigente(@Query('codigo') codigo: string) {
        return this.politicasService.obtenerPoliticaVigente(codigo || 'POLITICA_TRATAMIENTO_DATOS');
    }

    @Get('documento/:codigo')
    @Public()
    @ApiOperation({ summary: 'Obtener documento legal completo paginado' })
    async obtenerDocumento(@Param('codigo') codigo: string) {
        return this.politicasService.obtenerPoliticaVigente(codigo);
    }

    @Get('vigentes')
    @Public()
    @ApiOperation({ summary: 'Obtener todas las politicas vigentes completas' })
    async obtenerVigentes() {
        return this.politicasService.obtenerPoliticasVigentesPublicas();
    }

    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('JWT-auth')
    @Get('estado')
    @ApiOperation({ summary: 'Verificar si el usuario actual acepto la politica vigente' })
    async verificarEstado(@Request() req, @Query('codigo') codigo: string) {
        return this.politicasService.verificarConsentimiento(req.user, codigo || 'POLITICA_TRATAMIENTO_DATOS');
    }

    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('JWT-auth')
    @Get('estado-inicial')
    @ApiOperation({ summary: 'Obtener politicas obligatorias pendientes para mostrar modal inicial' })
    async estadoInicial(@Request() req) {
        return this.politicasService.obtenerEstadoInicial(req.user);
    }

    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('JWT-auth')
    @Post('aceptar')
    @ApiOperation({ summary: 'Registrar aceptacion de politica' })
    async aceptarPolitica(
        @Request() req,
        @Body() dto: RegistrarConsentimientoDto,
        @Ip() ip: string,
        @Headers('user-agent') ua: string,
        @Headers('x-forwarded-for') forwardedFor?: string,
    ) {
        return this.politicasService.registrarConsentimiento(req.user, dto, {
            ip: this.resolveIp(ip, forwardedFor),
            ua,
        });
    }

    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('JWT-auth')
    @Post('decision')
    @ApiOperation({ summary: 'Registrar aceptacion o rechazo expreso de politica' })
    async registrarDecision(
        @Request() req,
        @Body() dto: RegistrarConsentimientoDto,
        @Ip() ip: string,
        @Headers('user-agent') ua: string,
        @Headers('x-forwarded-for') forwardedFor?: string,
    ) {
        return this.politicasService.registrarConsentimiento(req.user, dto, {
            ip: this.resolveIp(ip, forwardedFor),
            ua,
        });
    }

    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('JWT-auth')
    @Get('pendientes')
    @ApiOperation({ summary: 'Listar politicas vigentes pendientes de aceptacion' })
    async obtenerPendientes(@Request() req) {
        return this.politicasService.obtenerPendientes(req.user);
    }

    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('JWT-auth')
    @Post('revocar')
    @ApiOperation({ summary: 'Revocar consentimiento previo' })
    async revocarConsentimiento(
        @Request() req,
        @Body('politica_id') politicaId: number,
        @Body('motivo') motivo: string,
        @Ip() ip: string,
        @Headers('user-agent') ua: string,
        @Headers('x-forwarded-for') forwardedFor?: string,
    ) {
        return this.politicasService.revocarConsentimiento(req.user, politicaId, motivo, {
            ip: this.resolveIp(ip, forwardedFor),
            ua,
        });
    }

    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('JWT-auth')
    @Post('admin/nueva-version')
    @RequirePermissions('sistema', 'admin_politicas')
    @ApiOperation({ summary: 'Crear nueva version de politica' })
    async crearNuevaVersion(@Request() req, @Body() dto: CrearPoliticaDto) {
        return this.politicasService.crearNuevaVersion(dto, req.user?.id);
    }

    private resolveIp(ip: string, forwardedFor?: string) {
        return forwardedFor?.split(',')[0]?.trim() || ip;
    }
}
