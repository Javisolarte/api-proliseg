import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateTipoVigilanteDto } from './dto/create-tipo-vigilante.dto';
import { UpdateTipoVigilanteDto } from './dto/update-tipo-vigilante.dto';

@Injectable()
export class TiposVigilanteService {
    private readonly logger = new Logger(TiposVigilanteService.name);

    constructor(private readonly supabaseService: SupabaseService) { }

    async create(createTipoVigilanteDto: CreateTipoVigilanteDto) {
        const supabase = this.supabaseService.getClient();
        this.logger.debug(`Creando tipo de vigilante: ${JSON.stringify(createTipoVigilanteDto)}`);

        const { data, error } = await supabase
            .from('tipos_vigilante')
            .insert(createTipoVigilanteDto)
            .select()
            .single();

        if (error) {
            this.logger.error(`Error creando tipo de vigilante: ${error.message}`);
            throw error;
        }

        return data;
    }

    async findAll() {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('tipos_vigilante')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            this.logger.error(`Error obteniendo tipos de vigilante: ${error.message}`);
            throw error;
        }

        return data;
    }

    async findOne(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('tipos_vigilante')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) {
            throw new NotFoundException(`Tipo de vigilante con ID ${id} no encontrado`);
        }

        return data;
    }

    async update(id: number, updateTipoVigilanteDto: UpdateTipoVigilanteDto) {
        const supabase = this.supabaseService.getClient();
        this.logger.debug(`Actualizando tipo de vigilante ${id}: ${JSON.stringify(updateTipoVigilanteDto)}`);

        const { data, error } = await supabase
            .from('tipos_vigilante')
            .update({
                ...updateTipoVigilanteDto,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            this.logger.error(`Error actualizando tipo de vigilante: ${error.message}`);
            throw error;
        }

        return data;
    }

    async remove(id: number) {
        const supabase = this.supabaseService.getClient();
        this.logger.debug(`Eliminando tipo de vigilante ${id}`);

        const { data, error } = await supabase
            .from('tipos_vigilante')
            .delete()
            .eq('id', id)
            .select()
            .single();

        if (error) {
            this.logger.error(`Error eliminando tipo de vigilante: ${error.message}`);
            throw error;
        }

        return data;
    }
}
