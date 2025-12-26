import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { CreateHorasNominaDto } from './dto/create-horas-nomina.dto';

@Injectable()
export class HorasNominaService {
    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly auditoriaService: AuditoriaService
    ) { }

    // Upsert horas in nomina_empleado
    async create(dto: CreateHorasNominaDto, userId: number) {
        const supabase = this.supabaseService.getClient();

        // 1. Verificar Periodo
        const { data: periodo } = await supabase.from('nomina_periodos').select('cerrado').eq('id', dto.periodo_id).single();
        if (!periodo) throw new NotFoundException('Periodo no encontrado');
        if (periodo.cerrado) throw new BadRequestException('El periodo está cerrado, no se pueden registrar horas');

        // 2. Verificar Empleado (Basic check)
        // (Optional, strict fk)

        // 3. Upsert en nomina_empleado
        // Check if record exists
        const { data: existingRecord } = await supabase
            .from('nomina_empleado')
            .select('*')
            .eq('periodo_id', dto.periodo_id)
            .eq('empleado_id', dto.empleado_id)
            .single();

        let result;
        if (existingRecord) {
            // Update
            const { data, error } = await supabase
                .from('nomina_empleado')
                .update({
                    horas_extra_diurnas: dto.cantidad_hed ?? existingRecord.horas_extra_diurnas,
                    horas_extra_nocturnas: dto.cantidad_hen ?? existingRecord.horas_extra_nocturnas,
                    horas_extra_festivas: (dto.cantidad_hefd ?? 0) + (dto.cantidad_hefn ?? 0),
                    horas_dominicales: (dto.cantidad_rfd ?? 0) + (dto.cantidad_rfn ?? 0), // Mapping rfd/rfn to Dominicales as best effort
                    // Recargos (rn) - No specific column in schema for just RN count. 
                    // We might need to rely on total value calculation or add column. 
                    // For now, ignoring RN count persistence if column missing.
                })
                .eq('id', existingRecord.id)
                .select()
                .single();
            if (error) throw new InternalServerErrorException(error.message);
            result = data;
        } else {
            // Insert (Pre-payroll generation)
            // This assumes we can create partial records. 
            // If inputs strictly require other fields, this might fail unless they are nullable/default.
            // Assuming we can insert just keys + hours.
            const { data, error } = await supabase
                .from('nomina_empleado')
                .insert({
                    periodo_id: dto.periodo_id,
                    empleado_id: dto.empleado_id,
                    horas_extra_diurnas: dto.cantidad_hed || 0,
                    horas_extra_nocturnas: dto.cantidad_hen || 0,
                    horas_extra_festivas: (dto.cantidad_hefd || 0) + (dto.cantidad_hefn || 0),
                    horas_dominicales: (dto.cantidad_rfd || 0) + (dto.cantidad_rfn || 0),
                    // RN ignored due to missing column
                })
                .select()
                .single();
            if (error) throw new InternalServerErrorException(error.message);
            result = data;
        }

        // Audit
        await this.auditoriaService.create({
            tabla_afectada: 'nomina_empleado',
            registro_id: result.id,
            accion: existingRecord ? 'UPDATE' : 'INSERT',
            datos_nuevos: result,
            usuario_id: userId
        });

        return result;
    }

    async findByEmpleado(empleadoId: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('nomina_empleado')
            .select('*')
            .eq('empleado_id', empleadoId);
        if (error) throw error;
        return data;
    }

    async findByPeriodo(periodoId: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('nomina_empleado')
            .select('*')
            .eq('periodo_id', periodoId);
        if (error) throw error;
        return data;
    }
}
