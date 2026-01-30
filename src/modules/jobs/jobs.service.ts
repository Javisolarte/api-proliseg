import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface JobData {
    tipo: 'email' | 'pdf' | 'webhook' | 'export';
    payload: any;
    max_intentos?: number;
}

@Injectable()
export class JobsService {
    private readonly logger = new Logger(JobsService.name);

    constructor(private readonly supabaseService: SupabaseService) { }

    async crearJob(data: JobData) {
        const supabase = this.supabaseService.getClient();

        const { data: job, error } = await supabase
            .from('jobs')
            .insert({
                tipo: data.tipo,
                payload: data.payload,
                max_intentos: data.max_intentos || 3,
                estado: 'pending',
            })
            .select()
            .single();

        if (error) throw new Error('Error creando job');

        this.logger.log(`Job creado: ${job.id} - tipo: ${data.tipo}`);
        return job;
    }

    async listarJobs(filters?: { estado?: string; tipo?: string; limit?: number }) {
        const supabase = this.supabaseService.getClient();

        let query = supabase
            .from('jobs')
            .select('*')
            .order('created_at', { ascending: false });

        if (filters?.estado) query = query.eq('estado', filters.estado);
        if (filters?.tipo) query = query.eq('tipo', filters.tipo);
        if (filters?.limit) query = query.limit(filters.limit);

        const { data, error } = await query;

        if (error) throw new Error('Error listando jobs');

        return data;
    }

    async obtenerJob(id: string) {
        const supabase = this.supabaseService.getClient();

        const { data, error } = await supabase
            .from('jobs')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw new Error('Job no encontrado');

        return data;
    }

    async marcarComoProcesando(id: string) {
        return this.actualizarEstado(id, 'processing');
    }

    async marcarComoCompletado(id: string) {
        const supabase = this.supabaseService.getClient();

        const { data, error } = await supabase
            .from('jobs')
            .update({
                estado: 'completed',
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw new Error('Error actualizando job');

        this.logger.log(`Job ${id} completado`);
        return data;
    }

    async marcarComoFallido(id: string, errorMessage: string) {
        const supabase = this.supabaseService.getClient();

        const { data: job } = await this.obtenerJob(id);
        const intentos = (job.intentos || 0) + 1;
        const estado = intentos >= job.max_intentos ? 'failed' : 'pending';

        const { data, error } = await supabase
            .from('jobs')
            .update({
                estado,
                error: errorMessage,
                intentos,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw new Error('Error actualizando job');

        this.logger.error(`Job ${id} falló. Intento ${intentos}/${job.max_intentos}`);
        return data;
    }

    async reintentar(id: string) {
        const supabase = this.supabaseService.getClient();

        const { data, error } = await supabase
            .from('jobs')
            .update({
                estado: 'pending',
                intentos: 0,
                error: null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw new Error('Error reintentando job');

        this.logger.log(`Job ${id} re-encolado para reintento`);
        return data;
    }

    private async actualizarEstado(id: string, estado: string) {
        const supabase = this.supabaseService.getClient();

        const { data, error } = await supabase
            .from('jobs')
            .update({ estado, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw new Error('Error actualizando estado');

        return data;
    }

    async obtenerEstadisticas() {
        const supabase = this.supabaseService.getClient();

        const { data: pending } = await supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('estado', 'pending');
        const { data: processing } = await supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('estado', 'processing');
        const { data: completed } = await supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('estado', 'completed');
        const { data: failed } = await supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('estado', 'failed');

        return {
            pending: pending?.length || 0,
            processing: processing?.length || 0,
            completed: completed?.length || 0,
            failed: failed?.length || 0,
        };
    }
}
