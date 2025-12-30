import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateTipoCursoVigilanciaDto } from './dto/create-tipo-curso-vigilancia.dto';
import { UpdateTipoCursoVigilanciaDto } from './dto/update-tipo-curso-vigilancia.dto';

@Injectable()
export class TiposCursoVigilanciaService {
    private readonly logger = new Logger(TiposCursoVigilanciaService.name);

    constructor(private readonly supabaseService: SupabaseService) { }

    async create(createTipoCursoVigilanciaDto: CreateTipoCursoVigilanciaDto) {
        const supabase = this.supabaseService.getClient();
        this.logger.debug(`Creando tipo de curso de vigilancia: ${JSON.stringify(createTipoCursoVigilanciaDto)}`);

        const { data, error } = await supabase
            .from('tipos_curso_vigilancia')
            .insert(createTipoCursoVigilanciaDto)
            .select()
            .single();

        if (error) {
            this.logger.error(`Error creando tipo de curso de vigilancia: ${error.message}`);
            throw error;
        }

        return data;
    }

    async findAll() {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('tipos_curso_vigilancia')
            .select('*')
            .order('nombre', { ascending: true });

        if (error) {
            this.logger.error(`Error obteniendo tipos de curso de vigilancia: ${error.message}`);
            throw error;
        }

        return data;
    }

    async findOne(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('tipos_curso_vigilancia')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) {
            throw new NotFoundException(`Tipo de curso de vigilancia con ID ${id} no encontrado`);
        }

        return data;
    }

    async update(id: number, updateTipoCursoVigilanciaDto: UpdateTipoCursoVigilanciaDto) {
        const supabase = this.supabaseService.getClient();
        this.logger.debug(`Actualizando tipo de curso de vigilancia ${id}: ${JSON.stringify(updateTipoCursoVigilanciaDto)}`);

        const { data, error } = await supabase
            .from('tipos_curso_vigilancia')
            .update({
                ...updateTipoCursoVigilanciaDto,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            this.logger.error(`Error actualizando tipo de curso de vigilancia: ${error.message}`);
            throw error;
        }

        return data;
    }

    async remove(id: number) {
        const supabase = this.supabaseService.getClient();
        this.logger.debug(`Eliminando tipo de curso de vigilancia ${id}`);

        const { data, error } = await supabase
            .from('tipos_curso_vigilancia')
            .delete()
            .eq('id', id)
            .select()
            .single();

        if (error) {
            this.logger.error(`Error eliminando tipo de curso de vigilancia: ${error.message}`);
            throw error;
        }

        return data;
    }
}
