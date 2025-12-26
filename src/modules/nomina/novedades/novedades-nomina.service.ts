import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { CreateNovedadNominaDto } from './dto/create-novedad-nomina.dto';

@Injectable()
export class NovedadesNominaService {
    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly auditoriaService: AuditoriaService
    ) { }

    async create(dto: CreateNovedadNominaDto, userId: number) {
        const supabase = this.supabaseService.getClient();

        // 1. Validar Periodo y Empleado (Opcional pero recomendado)
        // Por agilidad asumimos IDs validos o que la constraint de DB fallará.

        const { data, error } = await supabase
            .from('nomina_novedades')
            .insert({
                ...dto,
                creado_por: userId
            })
            .select()
            .single();

        if (error) throw new InternalServerErrorException(error.message);

        await this.auditoriaService.create({
            tabla_afectada: 'nomina_novedades',
            registro_id: data.id,
            accion: 'INSERT',
            datos_nuevos: data,
            usuario_id: userId
        });

        return data;
    }

    async findByPeriodo(periodoId: number) {
        const supabase = this.supabaseService.getClient();
        // Join with empleados to get names
        const { data, error } = await supabase
            .from('nomina_novedades')
            .select('*, empleados(nombre_completo, cedula)')
            .eq('periodo_id', periodoId);

        if (error) throw error;
        return data;
    }

    async remove(id: number, userId: number) {
        const supabase = this.supabaseService.getClient();

        // Check existence
        const { data: oldData } = await supabase
            .from('nomina_novedades')
            .select('*')
            .eq('id', id)
            .single();

        if (!oldData) throw new NotFoundException('Novedad no encontrada');

        // Check if period is closed (Optional but good practice)
        // const { data: periodo } = await supabase.from('nomina_periodos').select('cerrado').eq('id', oldData.periodo_id).single();
        // if (periodo?.cerrado) throw new BadRequestException('El periodo esta cerrado');

        const { error } = await supabase
            .from('nomina_novedades')
            .delete()
            .eq('id', id);

        if (error) throw new InternalServerErrorException(error.message);

        await this.auditoriaService.create({
            tabla_afectada: 'nomina_novedades',
            registro_id: id,
            accion: 'DELETE',
            datos_anteriores: oldData,
            usuario_id: userId
        });

        return { message: 'Novedad eliminada correctamente' };
    }
}
