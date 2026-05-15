import { Controller, Get, Post, Body, Param, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CotizacionesService } from './cotizaciones.service';

@ApiTags('Public')
@Controller('api/public/cotizaciones')
export class PublicCotizacionesController {
    constructor(private readonly cotizacionesService: CotizacionesService) { }

    @Get(':token')
    @ApiOperation({ summary: 'Ver cotización pública (sin login)' })
    async verCotizacionPublica(@Param('token') token: string) {
        return this.cotizacionesService.findByToken(token);
    }

    @Post(':token/aceptar')
    @ApiOperation({ summary: 'Aceptar cotización públicamente' })
    async aceptarCotizacion(@Param('token') token: string) {
        return this.cotizacionesService.aceptarPublico(token);
    }

    @Post(':token/rechazar')
    @ApiOperation({ summary: 'Rechazar cotización públicamente' })
    async rechazarCotizacion(
        @Param('token') token: string,
        @Body() body: { motivo: string, motivo_detalle?: string }
    ) {
        return this.cotizacionesService.rechazarPublico(token, body.motivo, body.motivo_detalle);
    }
}
