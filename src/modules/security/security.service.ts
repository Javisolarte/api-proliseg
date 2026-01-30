import { Injectable, Logger, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class SecurityService {
    private readonly logger = new Logger(SecurityService.name);
    private readonly MAX_INTENTOS = 5;
    private readonly TIEMPO_BLOQUEO_MINUTOS = 30;

    constructor(
        private readonly supabaseService: SupabaseService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) { }

    async bloquearUsuario(usuarioId: number, motivo: string, dias?: number) {
        const supabase = this.supabaseService.getClient();

        const bloqueadoHasta = dias
            ? new Date(Date.now() + dias * 24 * 60 * 60 * 1000)
            : null;

        const { data, error } = await supabase
            .from('usuarios_externos')
            .update({
                bloqueado: true,
                bloqueado_motivo: motivo,
                bloqueado_hasta: bloqueadoHasta?.toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', usuarioId)
            .select()
            .single();

        if (error) throw new BadRequestException('Error al bloquear usuario');

        this.logger.warn(`Usuario ${usuarioId} bloqueado. Motivo: ${motivo}`);

        // Invalidar sesiones del usuario
        await this.cerrarTodasSesionesUsuario(usuarioId);

        return data;
    }

    async desbloquearUsuario(usuarioId: number) {
        const supabase = this.supabaseService.getClient();

        const { data, error } = await supabase
            .from('usuarios_externos')
            .update({
                bloqueado: false,
                bloqueado_motivo: null,
                bloqueado_hasta: null,
                intentos_fallidos: 0,
                updated_at: new Date().toISOString(),
            })
            .eq('id', usuarioId)
            .select()
            .single();

        if (error) throw new BadRequestException('Error al desbloquear usuario');

        this.logger.log(`Usuario ${usuarioId} desbloqueado`);
        return data;
    }

    async registrarIntentoFallido(usuarioId: number) {
        const supabase = this.supabaseService.getClient();

        const { data: usuario } = await supabase
            .from('usuarios_externos')
            .select('intentos_fallidos')
            .eq('id', usuarioId)
            .single();

        if (!usuario) return;

        const intentos = (usuario.intentos_fallidos || 0) + 1;

        const updates: any = {
            intentos_fallidos: intentos,
            ultimo_intento_fallido: new Date().toISOString(),
        };

        // Auto-bloqueo si excede MAX_INTENTOS
        if (intentos >= this.MAX_INTENTOS) {
            updates.bloqueado = true;
            updates.bloqueado_motivo = `Auto-bloqueado por ${intentos} intentos fallidos`;
            updates.bloqueado_hasta = new Date(Date.now() + this.TIEMPO_BLOQUEO_MINUTOS * 60 * 1000).toISOString();

            this.logger.warn(`Usuario ${usuarioId} auto-bloqueado por intentos fallidos`);
        }

        await supabase
            .from('usuarios_externos')
            .update(updates)
            .eq('id', usuarioId);
    }

    async resetearIntentosFallidos(usuarioId: number) {
        const supabase = this.supabaseService.getClient();

        await supabase
            .from('usuarios_externos')
            .update({ intentos_fallidos: 0 })
            .eq('id', usuarioId);
    }

    // ===== SESSION MANAGEMENT =====

    async listarSesionesActivas(usuarioId?: number) {
        const supabase = this.supabaseService.getClient();

        let query = supabase
            .from('sesiones')
            .select('*, usuarios_externos(nombre_completo, email)')
            .gte('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false });

        if (usuarioId) {
            query = query.eq('usuario_id', usuarioId);
        }

        const { data, error } = await query;

        if (error) throw new BadRequestException('Error al listar sesiones');

        return data;
    }

    async cerrarSesion(sesionId: string) {
        const supabase = this.supabaseService.getClient();

        const { error } = await supabase
            .from('sesiones')
            .delete()
            .eq('id', sesionId);

        if (error) throw new BadRequestException('Error al cerrar sesión');

        this.logger.log(`Sesión ${sesionId} cerrada`);
        return { success: true };
    }

    async cerrarTodasSesionesUsuario(usuarioId: number) {
        const supabase = this.supabaseService.getClient();

        const { error } = await supabase
            .from('sesiones')
            .delete()
            .eq('usuario_id', usuarioId);

        if (error) throw new BadRequestException('Error al cerrar sesiones');

        this.logger.log(`Todas las sesiones del usuario ${usuarioId} cerradas`);
        return { success: true };
    }

    async verificarSesionValida(tokenHash: string): Promise<boolean> {
        const supabase = this.supabaseService.getClient();

        const { data } = await supabase
            .from('sesiones')
            .select('*')
            .eq('token_hash', tokenHash)
            .gte('expires_at', new Date().toISOString())
            .single();

        return !!data;
    }
}
