import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { CreateParametroNominaDto } from './dto/create-parametro-nomina.dto';
import { UpdateParametroNominaDto } from './dto/update-parametro-nomina.dto';

@Injectable()
export class ParametrosNominaService {
    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly auditoriaService: AuditoriaService
    ) { }

    async create(dto: CreateParametroNominaDto, userId: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from('nomina_valores_hora').insert({
            ...dto,
            creado_por: userId
        }).select().single();

        if (error) throw new InternalServerErrorException(error.message);

        await this.auditoriaService.create({
            tabla_afectada: 'nomina_valores_hora',
            registro_id: data.id,
            accion: 'INSERT',
            datos_nuevos: data,
            usuario_id: userId
        });

        return data;
    }

    async findAll() {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from('nomina_valores_hora').select('*').order('anio', { ascending: false });
        if (error) throw error;
        return data;
    }

    async findByYear(year: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from('nomina_valores_hora').select('*').eq('anio', year);
        if (error) throw error;
        return data;
    }

    async update(id: number, dto: UpdateParametroNominaDto, userId: number) {
        const supabase = this.supabaseService.getClient();
        const { data: oldData } = await supabase.from('nomina_valores_hora').select('*').eq('id', id).single();
        if (!oldData) throw new NotFoundException('Parametro no encontrado');

        const { data, error } = await supabase.from('nomina_valores_hora')
            .update(dto)
            .eq('id', id)
            .select()
            .single();

        if (error) throw new InternalServerErrorException(error.message);

        await this.auditoriaService.create({
            tabla_afectada: 'nomina_valores_hora',
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
        const { data: oldData } = await supabase.from('nomina_valores_hora').select('*').eq('id', id).single();
        if (!oldData) throw new NotFoundException('Parametro no encontrado');

        const { error } = await supabase.from('nomina_valores_hora').delete().eq('id', id);
        if (error) throw new InternalServerErrorException(error.message);

        await this.auditoriaService.create({
            tabla_afectada: 'nomina_valores_hora',
            registro_id: id,
            accion: 'DELETE',
            datos_anteriores: oldData,
            usuario_id: userId
        });

        return { message: 'Parametro eliminado correctamente' };
    }

    // 🔹 Clonar Parametros (Año X -> Año X+1)
    async clone(yearFrom: number, userId: number) {
        const supabase = this.supabaseService.getClient();
        const yearTo = yearFrom + 1;

        // 1. Obtener params del año base
        const { data: params } = await supabase.from('nomina_valores_hora').select('*').eq('anio', yearFrom);
        if (!params || params.length === 0) throw new NotFoundException(`No hay parametros en el año ${yearFrom}`);

        let clonedCount = 0;

        for (const p of params) {
            // Check existence in target year to avoid duplicates
            const { data: exists } = await supabase
                .from('nomina_valores_hora')
                .select('id')
                .eq('anio', yearTo)
                .eq('tipo', p.tipo)
                .single();

            if (!exists) {
                const { data: newParam } = await supabase.from('nomina_valores_hora').insert({
                    anio: yearTo,
                    tipo: p.tipo,
                    multiplicador: p.multiplicador,
                    descripcion: p.descripcion,
                    activo: true,
                    creado_por: userId
                }).select().single();

                if (newParam) {
                    clonedCount++;
                }
            }
        }

        // Audit Bulk Action
        await this.auditoriaService.create({
            tabla_afectada: 'nomina_valores_hora',
            registro_id: 0, // Bulk action, no specific ID
            accion: 'INSERT', // CLONE
            datos_nuevos: { year_from: yearFrom, year_to: yearTo, count: clonedCount, action: 'CLONE_YEAR_PARAMS' },
            usuario_id: userId
        });

        return { message: `Se clonaron ${clonedCount} parametros del año ${yearFrom} al ${yearTo}` };
    }
}
