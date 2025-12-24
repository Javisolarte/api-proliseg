import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateDotacionEmpleadoDto, CreateDotacionProgramacionDto, UpdateDotacionProgramacionDto } from './dto/dotacion.dto';

@Injectable()
export class DotacionesService {
    constructor(private readonly supabaseService: SupabaseService) { }

    // --- ASIGNACIONES (ENTREGAS) ---

    async findAllEntregas(condicion?: string) {
        const supabase = this.supabaseService.getClient();
        const query = supabase
            .from('dotaciones_empleado')
            .select(`
        *,
        empleado:empleados(id, nombre_completo, cedula),
        variante:articulos_dotacion_variantes(
            id, 
            talla,
            articulo:articulos_dotacion(id, nombre, codigo)
        ),
        usuario:usuarios_externos(id, nombre_completo)
      `)
            .order('fecha_entrega', { ascending: false });

        if (condicion) {
            query.eq('condicion', condicion);
        }

        const { data, error } = await query;

        if (error) throw error;
        return data;
    }

    async findEntregasByEmpleado(empleadoId: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('dotaciones_empleado')
            .select(`
        *,
        variante:articulos_dotacion_variantes(
            id, 
            talla,
            articulo:articulos_dotacion(id, nombre, codigo)
        ),
        usuario:usuarios_externos(id, nombre_completo)
      `)
            .eq('empleado_id', empleadoId)
            .order('fecha_entrega', { ascending: false });

        if (error) throw error;
        return data;
    }

    async registrarEntrega(createDto: CreateDotacionEmpleadoDto) {
        const supabase = this.supabaseService.getClient();

        // 1. Verify stock (only if 'nuevo', or logical business rule. Prompt says "Toda salida reduce stock")
        // Note: Stock reduction is handled by trigger on 'inventario_movimientos', but we need to create that movement FIRST or concurrently.
        // The prompt says: 
        // "Paso 2: Se registra movimiento: salida... Paso 3: Se registra la entrega legal: Tabla dotaciones_empleado"
        // So the API should do BOTH.

        // Check stock availability first (optional but good UX)
        const { data: variante, error: varError } = await supabase
            .from('articulos_dotacion_variantes')
            .select('stock_actual')
            .eq('id', createDto.variante_id)
            .single();

        if (varError || !variante) throw new NotFoundException('Variante no encontrada');
        if (variante.stock_actual < createDto.cantidad) {
            throw new BadRequestException(`Stock insuficiente. Disponible: ${variante.stock_actual}`);
        }

        // 2. Register 'inventario_movimientos' (Output)
        // We assume the service calling this provides the 'entregado_por' (user id)
        const { error: movError } = await supabase
            .from('inventario_movimientos')
            .insert({
                variante_id: createDto.variante_id,
                tipo_movimiento: 'salida',
                cantidad: createDto.cantidad,
                motivo: `Entrega dotación (` + createDto.condicion + `) a empleado ID: ` + createDto.empleado_id,
                empleado_id: createDto.empleado_id,
                realizado_por: createDto.entregado_por,
            })
            .select()
            .single();

        if (movError) throw movError;

        // 3. Register 'dotaciones_empleado'
        const { data, error } = await supabase
            .from('dotaciones_empleado')
            .insert(createDto)
            .select()
            .single();

        if (error) throw error;

        // 4. Update 'fecha_ultima_dotacion' in 'dotacion_programacion' (optional automation)
        // Check if programming exists
        const { data: prog } = await supabase.from('dotacion_programacion').select('id').eq('empleado_id', createDto.empleado_id).single();

        const nextDate = new Date();
        nextDate.setMonth(nextDate.getMonth() + 4); // +4 months rule

        if (prog) {
            await supabase.from('dotacion_programacion')
                .update({
                    fecha_ultima_dotacion: createDto.fecha_entrega,
                    fecha_proxima_dotacion: nextDate.toISOString().split('T')[0], // YYYY-MM-DD
                    estado: 'entregada' // or pending for next cycle? usually delivered resets cycle
                })
                .eq('id', prog.id);
        } else {
            await supabase.from('dotacion_programacion').insert({
                empleado_id: createDto.empleado_id,
                fecha_ultima_dotacion: createDto.fecha_entrega,
                fecha_proxima_dotacion: nextDate.toISOString().split('T')[0],
                estado: 'entregada'
            });
        }

        return data;
    }

    // --- PROGRAMACION ---

    async findAllProgramacion() {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('dotacion_programacion')
            .select(`
        *,
        empleado:empleados(id, nombre_completo, cedula, puesto_id)
      `)
            .order('fecha_proxima_dotacion', { ascending: true });

        if (error) throw error;
        return data;
    }

    async createProgramacion(createDto: CreateDotacionProgramacionDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from('dotacion_programacion').insert(createDto).select().single();
        if (error) throw error;
        return data;
    }
}
