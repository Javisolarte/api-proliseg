import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateProveedorDto, UpdateProveedorDto } from './dto/proveedor.dto';

@Injectable()
export class ProveedoresService {
    constructor(private readonly supabaseService: SupabaseService) { }

    async findAll() {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('proveedores')
            .select('*')
            .order('nombre', { ascending: true });

        if (error) throw error;
        return data;
    }

    async findOne(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('proveedores')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) {
            throw new NotFoundException(`Proveedor con ID ${id} no encontrado`);
        }

        return data;
    }

    async create(createDto: CreateProveedorDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('proveedores')
            .insert(createDto)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async update(id: number, updateDto: UpdateProveedorDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('proveedores')
            .update(updateDto)
            .eq('id', id)
            .select()
            .single();

        if (error || !data) {
            throw new NotFoundException(`Proveedor con ID ${id} no encontrado para actualizar`);
        }

        return data;
    }

    async remove(id: number) {
        const supabase = this.supabaseService.getClient();
        // Soft delete
        const { data, error } = await supabase
            .from('proveedores')
            .update({ activo: false })
            .eq('id', id)
            .select()
            .single();

        if (error || !data) {
            throw new NotFoundException(`Proveedor con ID ${id} no encontrado para desactivar`);
        }

        return { message: 'Proveedor desactivado exitosamente', data };
    }
}
