import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { ClienteConfiguracionDto } from './dto/cliente-config.dto';

@Injectable()
export class ClientesConfigService {
    private readonly logger = new Logger(ClientesConfigService.name);

    constructor(private readonly supabaseService: SupabaseService) { }

    async obtenerConfiguracion(clienteId: number) {
        const supabase = this.supabaseService.getClient();

        const { data, error } = await supabase
            .from('clientes_configuracion')
            .select('*')
            .eq('cliente_id', clienteId)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw new Error('Error obteniendo configuración');
        }

        // Si no existe, retornar configuración por defecto
        if (!data) {
            return this.obtenerConfiguracionPorDefecto();
        }

        return data;
    }

    async actualizarConfiguracion(clienteId: number, config: ClienteConfiguracionDto) {
        const supabase = this.supabaseService.getClient();

        // Intentar actualizar
        const { data: existing } = await supabase
            .from('clientes_configuracion')
            .select('id')
            .eq('cliente_id', clienteId)
            .single();

        if (existing) {
            // Update
            const { data, error } = await supabase
                .from('clientes_configuracion')
                .update({
                    horarios: config.horarios,
                    reglas_visitas: config.reglas_visitas,
                    limites: config.limites,
                    branding: config.branding,
                    updated_at: new Date().toISOString(),
                })
                .eq('cliente_id', clienteId)
                .select()
                .single();

            if (error) throw new Error('Error actualizando configuración');

            this.logger.log(`Configuración actualizada para cliente ${clienteId}`);
            return data;
        } else {
            // Insert
            const { data, error } = await supabase
                .from('clientes_configuracion')
                .insert({
                    cliente_id: clienteId,
                    horarios: config.horarios,
                    reglas_visitas: config.reglas_visitas,
                    limites: config.limites,
                    branding: config.branding,
                })
                .select()
                .single();

            if (error) throw new Error('Error creando configuración');

            this.logger.log(`Configuración creada para cliente ${clienteId}`);
            return data;
        }
    }

    private obtenerConfiguracionPorDefecto() {
        return {
            horarios: {
                entrada: '08:00',
                salida: '18:00',
                zona_horaria: 'America/Bogota',
            },
            reglas_visitas: {
                requiere_autorizacion: false,
                max_acompanantes: 5,
                registro_vehiculos: true,
            },
            limites: {
                max_guardias: 100,
                max_puestos: 50,
                max_contratos: 10,
            },
            branding: {
                color_primario: '#1976D2',
                color_secundario: '#424242',
            },
        };
    }
}
