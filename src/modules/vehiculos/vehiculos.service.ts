import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateVehiculoDto } from './dto/create-vehiculo.dto';
import { UpdateVehiculoDto } from './dto/update-vehiculo.dto';
import { CreateAsignacionVehiculoDto } from './dto/create-asignacion-vehiculo.dto';

@Injectable()
export class VehiculosService {
    constructor(private readonly supabaseService: SupabaseService) { }

    async create(createVehiculoDto: CreateVehiculoDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('vehiculos')
            .insert(createVehiculoDto)
            .select()
            .single();

        if (error) {
            if (error.code === '23505') { // Unique violation
                throw new BadRequestException('Ya existe un vehículo con esa placa.');
            }
            throw error;
        }
        return data;
    }

    async findAll() {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('vehiculos')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    }

    async findOne(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('vehiculos')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) {
            throw new NotFoundException(`Vehículo con ID ${id} no encontrado`);
        }
        return data;
    }

    async update(id: number, updateVehiculoDto: UpdateVehiculoDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('vehiculos')
            .update(updateVehiculoDto)
            .eq('id', id)
            .select()
            .single();

        if (error || !data) {
            throw new NotFoundException(`Vehículo con ID ${id} no encontrado`);
        }
        return data;
    }

    async remove(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('vehiculos')
            .delete()
            .eq('id', id)
            .select()
            .single();

        if (error || !data) {
            throw new NotFoundException(`Vehículo con ID ${id} no encontrado`);
        }
        return { message: 'Vehículo eliminado exitosamente', data };
    }

    // --- Asignación de Vehículos ---

    async asignarVehiculo(createAsignacionDto: CreateAsignacionVehiculoDto) {
        const supabase = this.supabaseService.getClient();

        // Validar si el supervisor existe
        const { data: supervisor } = await supabase
            .from('empleados')
            .select('id')
            .eq('id', createAsignacionDto.supervisor_id)
            .single();

        if (!supervisor) throw new NotFoundException('Supervisor no encontrado');

        const { data, error } = await supabase
            .from('supervisor_vehiculos')
            .insert(createAsignacionDto)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async getAsignacionPorTurno(turnoId: number) {
        // Nota: La relación directa turno->vehiculo no está en la tabla supervisor_vehiculos según el esquema dado (supervisor_vehiculos tiene supervisor_id, vehiculo_id, fecha).
        // Sin embargo, si queremos saber qué vehículo usó un supervisor en un turno, debemos buscar por supervisor y fecha del turno.
        // O quizás "turnos" deberia tener vehiculo_id?
        // El prompt dice: "Asignación de vehículo a supervisor por turno".
        // Y en los endpoints sugeridos: GET /api/vehiculos-asignacion/turno/{turno_id}

        // Voy a obtener el turno, ver el supervisor y la fecha, y buscar la asignación correspondiente.
        const supabase = this.supabaseService.getClient();

        const { data: turno, error: turnoError } = await supabase
            .from('turnos')
            .select('empleado_id, fecha')
            .eq('id', turnoId)
            .single();

        if (turnoError || !turno) throw new NotFoundException('Turno no encontrado');
        if (!turno.empleado_id) throw new BadRequestException('El turno no tiene supervisor/empleado asignado');

        const { data, error } = await supabase
            .from('supervisor_vehiculos')
            .select(`
            *,
            vehiculo:vehiculos(*)
         `)
            .eq('supervisor_id', turno.empleado_id)
            .eq('fecha_asignacion', turno.fecha) // Asumiendo que la fecha de asignacion coincide con el turno
            .single();

        if (error && error.code !== 'PGRST116') throw error; // Ignorar not found single

        return data || { message: 'No hay vehículo asignado explícitamente para esta fecha/supervisor' };
    }

    async getAsignacionPorVehiculo(vehiculoId: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('supervisor_vehiculos')
            .select(`
              *,
              supervisor:empleados(id, nombre_completo)
          `)
            .eq('vehiculo_id', vehiculoId)
            .order('fecha_asignacion', { ascending: false });

        if (error) throw error;
        return data;
    }

    async removeAsignacion(id: number) {
        const supabase = this.supabaseService.getClient();
        const { error } = await supabase
            .from('supervisor_vehiculos')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return { message: 'Asignación eliminada' };
    }
}
