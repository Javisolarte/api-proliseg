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
}
