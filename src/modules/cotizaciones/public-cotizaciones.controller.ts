import { Controller, Get, Param, ParseIntPipe, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SupabaseService } from '../supabase/supabase.service';

@ApiTags('Public')
@Controller('api/public/cotizaciones')
export class PublicCotizacionesController {
    constructor(private readonly supabaseService: SupabaseService) { }

    @Get(':token')
    @ApiOperation({ summary: 'Ver cotización pública (sin login)' })
    async verCotizacionPublica(@Param('token') token: string) {
        const supabase = this.supabaseService.getClient();

        const { data, error } = await supabase
            .from('cotizaciones')
            .select(`
        *,
        cotizaciones_items(*),
        clientes(nombre_empresa, direccion, telefono)
      `)
            .eq('public_token', token)
            .single();

        if (error || !data) {
            throw new NotFoundException('Cotización no encontrada o token inválido');
        }

        // Verificar expiración del token
        if (data.public_token_expires_at && new Date(data.public_token_expires_at) < new Date()) {
            throw new NotFoundException('El enlace ha expirado');
        }

        return data;
    }
}
