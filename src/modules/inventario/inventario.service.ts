import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateInventarioDocumentoDto, CreateInventarioMovimientoDto } from './dto/inventario.dto';

@Injectable()
export class InventarioService {
    constructor(private readonly supabaseService: SupabaseService) { }

    // --- DOCUMENTOS ---

    async findAllDocumentos() {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('inventario_documentos')
            .select(`
        *,
        proveedor:proveedores(id, nombre)
      `)
            .order('fecha', { ascending: false });

        if (error) throw error;
        return data;
    }

    async findOneDocumento(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('inventario_documentos')
            .select(`
        *,
        proveedor:proveedores(id, nombre)
      `)
            .eq('id', id)
            .single();

        if (error || !data) {
            throw new NotFoundException(`Documento con ID ${id} no encontrado`);
        }
        return data;
    }

    async createDocumento(createDto: CreateInventarioDocumentoDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('inventario_documentos')
            .insert(createDto)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    // --- MOVIMIENTOS ---

    async findAllMovimientos() {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from('inventario_movimientos')
            .select(`
        *,
        variante:articulos_dotacion_variantes(
            id, 
            talla,
            articulo:articulos_dotacion(id, nombre, codigo)
        ),
        documento:inventario_documentos(id, numero_documento, tipo),
        empleado:empleados(id, nombre_completo),
        usuario:usuarios_externos(id, nombre_completo)
      `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    }

    async createMovimiento(createDto: CreateInventarioMovimientoDto) {
        const supabase = this.supabaseService.getClient();

        // Note: Use a transaction or RPC if complex logic is needed, but prompt says Trigger handles stock.
        // So we just insert the movement.

        const { data, error } = await supabase
            .from('inventario_movimientos')
            .insert(createDto)
            .select()
            .single();

        if (error) throw error;
        return data;
    }


    // --- REPORTES / CALCULOS ---

    async getResumenStock(varianteId: number) {
        const supabase = this.supabaseService.getClient();

        // 1. Get current total stock
        const { data: variante, error: varError } = await supabase
            .from('articulos_dotacion_variantes')
            .select(`
                *,
                articulo:articulos_dotacion(nombre)
            `)
            .eq('id', varianteId)
            .single();

        if (varError || !variante) throw new NotFoundException('Variante no encontrada');

        // 2. Calculate "Second Hand" and "New" based on history
        // This is an ESTIMATION because strict tracking isn't in the DB columns

        const { data: movimientos, error: movError } = await supabase
            .from('inventario_movimientos')
            .select('tipo_movimiento, cantidad, motivo')
            .eq('variante_id', varianteId);

        if (movError) throw movError;

        let totalEntradasNuevas = 0;
        let totalEntradasSegunda = 0; // Devoluciones
        let totalSalidasNuevas = 0;
        let totalSalidasSegunda = 0;

        movimientos.forEach(m => {
            const motivo = (m.motivo || '').toLowerCase();

            if (m.tipo_movimiento === 'entrada') {
                if (motivo.includes('devolución') || motivo.includes('retorno') || motivo.includes('segunda')) {
                    totalEntradasSegunda += m.cantidad;
                } else {
                    totalEntradasNuevas += m.cantidad; // Assumed Purchase
                }
            } else if (m.tipo_movimiento === 'salida') {
                if (motivo.includes('(segunda)') || motivo.includes('segunda')) {
                    totalSalidasSegunda += m.cantidad;
                } else {
                    totalSalidasNuevas += m.cantidad; // Assumed New Delivery
                }
            }
        });

        const stockTeoricoNuevo = totalEntradasNuevas - totalSalidasNuevas;
        const stockTeoricoSegunda = totalEntradasSegunda - totalSalidasSegunda;

        return {
            variante_id: variante.id,
            nombre_articulo: variante.articulo?.nombre,
            talla: variante.talla,
            stock_total_real: variante.stock_actual,
            stock_teorico_nuevo: stockTeoricoNuevo < 0 ? 0 : stockTeoricoNuevo, // Prevent negatives in case of data inconsistency
            stock_teorico_segunda: stockTeoricoSegunda < 0 ? 0 : stockTeoricoSegunda,
            explicacion: "El cálculo se basa en el historial de movimientos. Entradas con motivo 'Devolución' suman al stock de segunda. Salidas con motivo '(segunda)' restan al stock de segunda."
        };
    }
}
