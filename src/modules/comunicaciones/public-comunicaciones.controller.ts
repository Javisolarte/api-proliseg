import { Controller, Post, Body, UseGuards, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ComunicacionesService } from '../comunicaciones/comunicaciones.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import type { EnviarEmailDto, EnviarWhatsAppDto, EnviarCotizacionDto } from '../comunicaciones/dto/comunicaciones.dto';

@ApiTags('Public Communications')
@Controller('api/public/comunicaciones')
export class PublicComunicacionesController {
    constructor(private readonly comunicacionesService: ComunicacionesService) { }

    @Post('enviar-email')
    @UseGuards(JwtAuthGuard)
    @RequirePermissions('comunicaciones', 'enviar')
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Enviar email' })
    async enviarEmail(@Body() dto: EnviarEmailDto) {
        return this.comunicacionesService.enviarEmail(
            dto.destinatarios,
            dto.asunto,
            dto.cuerpo,
            dto.adjuntos
        );
    }

    @Post('enviar-whatsapp')
    @UseGuards(JwtAuthGuard)
    @RequirePermissions('comunicaciones', 'enviar')
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Enviar WhatsApp' })
    async enviarWhatsApp(@Body() dto: EnviarWhatsAppDto) {
        return this.comunicacionesService.enviarWhatsApp(dto.numero, dto.mensaje);
    }

    @Post('enviar-cotizacion')
    @UseGuards(JwtAuthGuard)
    @RequirePermissions('cotizaciones', 'enviar')
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Enviar cotización por email/WhatsApp' })
    async enviarCotizacion(@Body() dto: EnviarCotizacionDto) {
        return this.comunicacionesService.enviarCotizacionCliente(
            dto.cotizacion_id,
            dto.email_cliente,
            dto.telefono_cliente,
            dto.enviar_whatsapp
        );
    }

    @Get('ice-servers')
    @ApiOperation({ summary: 'Obtener servidores ICE públicos' })
    async getIceServers() {
        return {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' },
                { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
                { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' }
            ]
        };
    }
}
