import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateEvidenciaDto } from './dto/create-evidencia.dto';

@Injectable()
export class EvidenciasService {
    constructor(private readonly supabaseService: SupabaseService) { }

    async create(dto: CreateEvidenciaDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from('minutas_rutas_evidencias').insert(dto).select().single();
        if (error) throw error;
        return data;
    }

    async findOne(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from('minutas_rutas_evidencias').select('*').eq('id', id).single();
        if (error || !data) throw new NotFoundException('Evidencia no encontrada');
        return data;
    }

    async findByCheckeo(checkeoId: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('minutas_rutas_evidencias')
            .select('*')
            .eq('minuta_id', checkeoId);
        if (error) throw error;
        return data;
    }

    async remove(id: number) {
        const supabase = this.supabaseService.getClient();
        const { error } = await supabase.from('minutas_rutas_evidencias').delete().eq('id', id);
        if (error) throw error;
        return { message: 'Evidencia eliminada' };
    }
}
