import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateCategoriaDotacionDto, UpdateCategoriaDotacionDto } from './dto/categoria-dotacion.dto';

@Injectable()
export class CategoriasDotacionService {
    constructor(private readonly supabaseService: SupabaseService) { }

    async findAll() {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('categorias_dotacion')
            .select('*')
            .order('nombre', { ascending: true });

        if (error) throw error;
        return data;
    }

    async findOne(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('categorias_dotacion')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) {
            throw new NotFoundException(`Categoría con ID ${id} no encontrada`);
        }

        return data;
    }

    async create(createDto: CreateCategoriaDotacionDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('categorias_dotacion')
            .insert(createDto)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async update(id: number, updateDto: UpdateCategoriaDotacionDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('categorias_dotacion')
            .update(updateDto)
            .eq('id', id)
            .select()
            .single();

        if (error || !data) {
            throw new NotFoundException(`Categoría con ID ${id} no encontrada para actualizar`);
        }

        return data;
    }

    async remove(id: number) {
        const supabase = this.supabaseService.getClient();

        // Check if it's being used by any article before deleting (optional validation, though DB FK handles strictly)
        const { count, error: countError } = await supabase
            .from('articulos_dotacion')
            .select('*', { count: 'exact', head: true })
            .eq('categoria_id', id);

        if (countError) throw countError;
        if (count && count > 0) {
            throw new Error('No se puede eliminar la categoría porque tiene artículos asociados.');
        }

        const { data, error } = await supabase
            .from('categorias_dotacion')
            .delete()
            .eq('id', id)
            .select()
            .single();

        if (error || !data) {
            throw new NotFoundException(`Categoría con ID ${id} no encontrada para eliminar`);
        }

        return { message: 'Categoría eliminada exitosamente', data };
    }
}
