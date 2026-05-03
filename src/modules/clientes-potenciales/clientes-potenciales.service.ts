import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { CreateClientePotencialDto, UpdateClientePotencialDto } from './dto/cliente-potencial.dto';

@Injectable()
export class ClientesPotencialesService {
    constructor(private readonly supabase: SupabaseService) {}

    async create(createDto: CreateClientePotencialDto) {
        const { data, error } = await this.supabase.getClient()
            .from('clientes_potenciales')
            .insert(createDto)
            .select()
            .single();

        if (error) {
            console.error('Error al crear cliente potencial:', error);
            throw new InternalServerErrorException('No se pudo crear el cliente potencial');
        }

        return data;
    }

    async findAll() {
        const { data, error } = await this.supabase.getClient()
            .from('clientes_potenciales')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error al obtener clientes potenciales:', error);
            throw new InternalServerErrorException('No se pudieron obtener los clientes potenciales');
        }

        return data;
    }

    async findOne(id: string) {
        const { data, error } = await this.supabase.getClient()
            .from('clientes_potenciales')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            throw new NotFoundException(`Cliente potencial con ID ${id} no encontrado`);
        }

        return data;
    }

    async update(id: string, updateDto: UpdateClientePotencialDto) {
        const { data, error } = await this.supabase.getClient()
            .from('clientes_potenciales')
            .update({
                ...updateDto,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error al actualizar cliente potencial:', error);
            throw new InternalServerErrorException('No se pudo actualizar el cliente potencial');
        }

        return data;
    }

    async remove(id: string) {
        const { data, error } = await this.supabase.getClient()
            .from('clientes_potenciales')
            .delete()
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error al eliminar cliente potencial:', error);
            throw new InternalServerErrorException('No se pudo eliminar el cliente potencial');
        }

        return data;
    }
}
