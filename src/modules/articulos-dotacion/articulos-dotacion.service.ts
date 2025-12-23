import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
    CreateArticuloDotacionDto,
    UpdateArticuloDotacionDto,
    CreateVarianteArticuloDto,
    UpdateVarianteArticuloDto,
} from './dto/articulo-dotacion.dto';

@Injectable()
export class ArticulosDotacionService {
    constructor(private readonly supabaseService: SupabaseService) { }

    // --- ARTICULOS ---

    async findAll() {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('articulos_dotacion')
            .select(`
        *,
        categoria:categorias_dotacion(id, nombre)
      `)
            .order('nombre', { ascending: true });

        if (error) throw error;
        return data;
    }

    async findOne(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('articulos_dotacion')
            .select(`
        *,
        categoria:categorias_dotacion(id, nombre),
        variantes:articulos_dotacion_variantes(*)
      `)
            .eq('id', id)
            .single();

        if (error || !data) {
            throw new NotFoundException(`Artículo con ID ${id} no encontrado`);
        }

        return data;
    }

    async create(createDto: CreateArticuloDotacionDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('articulos_dotacion')
            .insert(createDto)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async update(id: number, updateDto: UpdateArticuloDotacionDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('articulos_dotacion')
            .update({
                ...updateDto,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error || !data) {
            throw new NotFoundException(`Artículo con ID ${id} no encontrado para actualizar`);
        }

        return data;
    }

    async remove(id: number) {
        // Soft delete logic (active = false) is preferred if history is important, 
        // but the Schema has 'activo' boolean. The prompt says 'No maneja stock ni estado' for 'articulos_dotacion',
        // but the schema has 'activo' and 'stock' is in variants. 
        // I will implement soft delete by setting active to false.
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('articulos_dotacion')
            .update({
                activo: false,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error || !data) {
            throw new NotFoundException(`Artículo con ID ${id} no encontrado para desactivar`);
        }

        return { message: 'Artículo desactivado exitosamente', data };
    }

    // --- VARIANTES ---

    async createVariante(createDto: CreateVarianteArticuloDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('articulos_dotacion_variantes')
            .insert(createDto)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async updateVariante(id: number, updateDto: UpdateVarianteArticuloDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('articulos_dotacion_variantes')
            .update({
                ...updateDto,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error || !data) {
            throw new NotFoundException(`Variante con ID ${id} no encontrada`);
        }

        return data;
    }

    async findVariantesByArticulo(articuloId: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('articulos_dotacion_variantes')
            .select('*')
            .eq('articulo_id', articuloId);

        if (error) throw error;
        return data;
    }
}
