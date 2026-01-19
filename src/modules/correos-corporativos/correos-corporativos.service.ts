import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateCorreoDto, UpdateCorreoDto, AsignarCorreoDto, DevolverCorreoDto } from './dto/correo.dto';

@Injectable()
export class CorreosCorporativosService {
    constructor(private readonly supabaseService: SupabaseService) { }

    async findAll() {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('correos_corporativos')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    }

    async findOne(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('correos_corporativos')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) {
            throw new NotFoundException(`Correo con ID ${id} no encontrado`);
        }

        return data;
    }

    async create(createCorreoDto: CreateCorreoDto) {
        const supabase = this.supabaseService.getClient();

        // Validar duplicados
        const { data: existing } = await supabase
            .from('correos_corporativos')
            .select('id')
            .eq('direccion_correo', createCorreoDto.direccion_correo)
            .single();

        if (existing) {
            throw new BadRequestException('El correo ya existe');
        }

        const { data, error } = await supabase
            .from('correos_corporativos')
            .insert(createCorreoDto)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async update(id: number, updateCorreoDto: UpdateCorreoDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('correos_corporativos')
            .update({
                ...updateCorreoDto,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error || !data) {
            // Puede ser que no encontró o error de DB
            if (!data) throw new NotFoundException(`Correo con ID ${id} no encontrado`);
            throw error;
        }

        return data;
    }

    async remove(id: number) {
        const supabase = this.supabaseService.getClient();
        // Soft delete (cambiar estado) o hard delete? 
        // El prompt inicial decía "eliminado" como estado CHECK. Usaremos eso.
        const { data, error } = await supabase
            .from('correos_corporativos')
            .update({
                estado: 'eliminado',
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error || !data) {
            throw new NotFoundException(`Correo con ID ${id} no encontrado`);
        }

        return { message: 'Correo marcado como eliminado', data };
    }

    // ------------------------------------------------------------------
    // ASIGNACIONES
    // ------------------------------------------------------------------

    async asignarCorreo(dto: AsignarCorreoDto) {
        const supabase = this.supabaseService.getClient();

        // 1. Verificar si el correo ya está asignado activamente (redundante con unique index, pero buen manejo de error)
        const { data: ocupado } = await supabase
            .from('correos_asignaciones')
            .select('id')
            .eq('correo_id', dto.correo_id)
            .eq('activo', true)
            .single();

        if (ocupado) {
            throw new BadRequestException('Este correo ya está asignado a otro empleado activo.');
        }

        // 2. Insertar asignación
        const { data, error } = await supabase
            .from('correos_asignaciones')
            .insert({
                correo_id: dto.correo_id,
                empleado_id: dto.empleado_id,
                asignado_por: dto.asignado_por,
                observaciones: dto.observaciones,
                fecha_asignacion: new Date().toISOString(), // Default db now(), pero explícito ok
                activo: true
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async devolverCorreo(asignacionId: number, dto: DevolverCorreoDto) {
        const supabase = this.supabaseService.getClient();

        const { data, error } = await supabase
            .from('correos_asignaciones')
            .update({
                activo: false,
                fecha_devolucion: new Date().toISOString(),
                observaciones: dto.observaciones ? dto.observaciones : undefined, // Append or replace? Supongo replace o update
                updated_at: new Date().toISOString()
            })
            .eq('id', asignacionId)
            .select()
            .single();

        if (error || !data) {
            throw new NotFoundException('Asignación no encontrada');
        }
        return data;
    }

    async getAsignaciones(correoId?: number, empleadoId?: number) {
        const supabase = this.supabaseService.getClient();
        let query = supabase
            .from('correos_asignaciones')
            .select(`
            *,
            correos_corporativos (direccion_correo, proveedor, estado),
            empleados (id, nombre_completo),
            usuarios_externos:asignado_por (nombre_completo)
        `);

        if (correoId) query = query.eq('correo_id', correoId);
        if (empleadoId) query = query.eq('empleado_id', empleadoId);

        const { data, error } = await query.order('fecha_asignacion', { ascending: false });
        if (error) throw error;
        return data;
    }
}
