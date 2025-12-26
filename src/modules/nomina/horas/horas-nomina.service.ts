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
                    cantidad_hed: dto.cantidad_hed ?? existingRecord.cantidad_hed,
                    cantidad_hen: dto.cantidad_hen ?? existingRecord.cantidad_hen,
                    cantidad_hefd: dto.cantidad_hefd ?? existingRecord.cantidad_hefd,
                    cantidad_hefn: dto.cantidad_hefn ?? existingRecord.cantidad_hefn,
                    cantidad_rn: dto.cantidad_rn ?? existingRecord.cantidad_rn,
                    cantidad_rfd: dto.cantidad_rfd ?? existingRecord.cantidad_rfd,
                    cantidad_rfn: dto.cantidad_rfn ?? existingRecord.cantidad_rfn,
                    // Note: Recalculation of totals should ideally happen here or trigger recalculate
                    // For now we just save the hours. The 'recalcular' endpoint handles money.
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
                    cantidad_hed: dto.cantidad_hed || 0,
                    cantidad_hen: dto.cantidad_hen || 0,
                    cantidad_hefd: dto.cantidad_hefd || 0,
                    cantidad_hefn: dto.cantidad_hefn || 0,
                    cantidad_rn: dto.cantidad_rn || 0,
                    cantidad_rfd: dto.cantidad_rfd || 0,
                    cantidad_rfn: dto.cantidad_rfn || 0,
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
