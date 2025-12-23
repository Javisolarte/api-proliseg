import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

import { CreateModuloDto } from './dto/create-modulo.dto';

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

    async create(createModuloDto: CreateModuloDto) {
        const supabase = this.supabaseService.getSupabaseAdminClient();
        const { data, error } = await supabase
            .from('modulos')
            .insert([createModuloDto])
            .select()
            .single();

        if (error) throw new InternalServerErrorException(error.message);
        return data;
    }
}
