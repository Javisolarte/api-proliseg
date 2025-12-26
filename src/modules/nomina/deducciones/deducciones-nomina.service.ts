import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { CreateDeduccionNominaDto } from './dto/create-deduccion-nomina.dto';
import { UpdateDeduccionNominaDto } from './dto/update-deduccion-nomina.dto';

@Injectable()
export class DeduccionesNominaService {
    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly auditoriaService: AuditoriaService
    ) { }

    async create(dto: CreateDeduccionNominaDto, userId: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from('nomina_deducciones').insert({
            ...dto,
            creado_por: userId
        }).select().single();

        if (error) throw new InternalServerErrorException(error.message);

        await this.auditoriaService.create({
            tabla_afectada: 'nomina_deducciones',
            registro_id: data.id,
            accion: 'INSERT',
            datos_nuevos: data,
            usuario_id: userId
        });

        return data;
    }

    async findAll() {
        const supabase = this.supabaseService.getClient();
        // findAll returns all, active or not? Usually admin wants to see all.
        const { data, error } = await supabase.from('nomina_deducciones').select('*').order('nombre', { ascending: true });
        if (error) throw error;
        return data;
    }

    async findActive() {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from('nomina_deducciones').select('*').eq('activo', true).order('nombre', { ascending: true });
        if (error) throw error;
        return data;
    }

    async update(id: number, dto: UpdateDeduccionNominaDto, userId: number) {
        const supabase = this.supabaseService.getClient();
        const { data: oldData } = await supabase.from('nomina_deducciones').select('*').eq('id', id).single();
        if (!oldData) throw new NotFoundException('Deduccion no encontrada');

        const { data, error } = await supabase.from('nomina_deducciones')
            .update(dto)
            .eq('id', id)
            .select()
            .single();

        if (error) throw new InternalServerErrorException(error.message);

        await this.auditoriaService.create({
            tabla_afectada: 'nomina_deducciones',
            registro_id: id,
            accion: 'UPDATE',
            datos_anteriores: oldData,
            datos_nuevos: data,
            usuario_id: userId
        });

        return data;
    }

    async remove(id: number, userId: number) {
        const supabase = this.supabaseService.getClient();
        const { data: oldData } = await supabase.from('nomina_deducciones').select('*').eq('id', id).single();
        if (!oldData) throw new NotFoundException('Deduccion no encontrada');

        const { error } = await supabase.from('nomina_deducciones').delete().eq('id', id);
        if (error) throw new InternalServerErrorException(error.message);

        await this.auditoriaService.create({
            tabla_afectada: 'nomina_deducciones',
            registro_id: id,
            accion: 'DELETE',
            datos_anteriores: oldData,
            usuario_id: userId
        });

        return { message: 'Deduccion eliminada correctamente' };
    }
}
