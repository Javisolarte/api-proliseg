import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class ModulosService {
    constructor(private readonly supabaseService: SupabaseService) { }

    async findAll() {
        const supabase = this.supabaseService.getSupabaseAdminClient();
        const { data, error } = await supabase
            .from('modulos')
            .select('*')
            .order('nombre', { ascending: true });

        if (error) throw new InternalServerErrorException(error.message);
        return data;
    }
}
