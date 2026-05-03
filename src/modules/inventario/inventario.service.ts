import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateInventarioDocumentoDto, CreateInventarioMovimientoDto } from './dto/inventario.dto';
import { DocumentosGeneradosService } from '../documentos-generados/documentos-generados.service';
import { EntidadTipo } from '../documentos-generados/dto/documento-generado.dto';

@Injectable()
export class InventarioService {
    private readonly logger = new Logger(InventarioService.name);

    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly documentosService: DocumentosGeneradosService
    ) { }

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

    async getAlertas() {
        // Alertas de stock bajo
        const supabase = this.supabaseService.getClient();
        const { data } = await supabase.from('articulos_dotacion_variantes')
            .select('*, articulo:articulos_dotacion(nombre)')
            .lt('stock_actual', 5) // Umbral fijo (hardcoded) o campo 'stock_minimo' si existe
            .order('stock_actual', { ascending: true });
        return data || [];
    }

    async getReporteGeneral() {
        const supabase = this.supabaseService.getClient();
        // Agregaciones
        const { count: items } = await supabase.from('articulos_dotacion').select('*', { count: 'exact', head: true });
        const { count: variantes } = await supabase.from('articulos_dotacion_variantes').select('*', { count: 'exact', head: true });

        // Calcular valor total inventario (costo promedio estimado, si hubiera campo costo)
        // Por ahora conteo básico
        return {
            total_articulos: items || 0,
            total_variantes: variantes || 0,
            fecha_reporte: new Date()
        };
    }

    async generarReportePorCategoria(categoriaId: number, userId: number) {
        try {
            const supabase = this.supabaseService.getClient();

            // 1. Obtener la categoría
            const { data: categoria } = await supabase
                .from('categorias_dotacion')
                .select('nombre')
                .eq('id', categoriaId)
                .single();

            if (!categoria) {
                throw new NotFoundException(`Categoría no encontrada`);
            }

            // 2. Obtener los artículos de esta categoría
            const { data: articulos } = await supabase
                .from('articulos_dotacion')
                .select(`
                    id, 
                    nombre, 
                    codigo,
                    descripcion,
                    variantes:articulos_dotacion_variantes(
                        id, 
                        talla, 
                        stock_actual
                    )
                `)
                .eq('categoria_id', categoriaId)
                .eq('activo', true);

            if (!articulos || articulos.length === 0) {
                throw new NotFoundException(`No hay artículos para la categoría ${categoria.nombre}`);
            }

            // 3. Obtener el empleado que genera el reporte
            const { data: empleado } = await supabase
                .from('empleados')
                .select('nombre_completo, cargo_oficial, firma_digital_base64')
                .eq('id', userId)
                .single();

            const generadoPor = empleado?.nombre_completo || 'Usuario del Sistema';
            const cargoGenerador = empleado?.cargo_oficial || 'Administrador';
            const firmaGenerador = empleado?.firma_digital_base64 ? `data:image/png;base64,${empleado.firma_digital_base64}` : null;

            // 4. Buscar la plantilla SIG-GO-F-20
            const { data: plantilla } = await supabase
                .from('plantillas_documentos')
                .select('id')
                .eq('nombre', 'SIG-GO-F-20')
                .eq('activa', true)
                .order('version', { ascending: false })
                .limit(1)
                .single();

            if (!plantilla) {
                this.logger.warn("No se encontró plantilla activa SIG-GO-F-20");
                throw new NotFoundException(`Plantilla SIG-GO-F-20 no encontrada`);
            }

            // 5. Formatear los ítems
            let itemsFormat: any[] = [];
            let index = 1;
            let totalCantidad = 0;

            for (const art of articulos) {
                if (art.variantes && art.variantes.length > 0) {
                    for (const varItem of art.variantes) {
                        itemsFormat.push({
                            index: index++,
                            descripcion: art.nombre || 'Sin descripción',
                            marca_modelo: art.codigo || 'N/A',
                            serial: varItem.talla || 'N/A', 
                            ubicacion: 'Bodega Principal',
                            estado: 'BUENO',
                            cantidad: varItem.stock_actual || 0
                        });
                        totalCantidad += varItem.stock_actual || 0;
                    }
                } else {
                    itemsFormat.push({
                        index: index++,
                        descripcion: art.nombre || 'Sin descripción',
                        marca_modelo: art.codigo || 'N/A',
                        serial: 'N/A',
                        ubicacion: 'Bodega Principal',
                        estado: 'N/A',
                        cantidad: 0
                    });
                }
            }

            // Formatear fecha
            const options: Intl.DateTimeFormatOptions = { 
                timeZone: 'America/Bogota',
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
                hour12: false
            };
            const formatter = new Intl.DateTimeFormat('es-CO', options);
            const dateParts = formatter.formatToParts(new Date());
            const getPart = (type: string) => dateParts.find(p => p.type === type)?.value;
            const fechaReporte = `${getPart('day')}/${getPart('month')}/${getPart('year')} ${getPart('hour')}:${getPart('minute')}`;

            const datos = {
                fecha_reporte: fechaReporte,
                generado_por: generadoPor,
                total_items: totalCantidad,
                items: itemsFormat,
                firma_generador: firmaGenerador,
                cargo_generador: cargoGenerador
            };

            // 6. Crear documento
            const doc = await this.documentosService.create({
                plantilla_id: plantilla.id,
                entidad_tipo: EntidadTipo.EMPLEADO,
                entidad_id: userId,
                datos_json: datos
            });

            // 7. Generar PDF
            const pdfResult = await this.documentosService.generarPdf(doc.id);

            return { 
                url_pdf: pdfResult?.url_pdf || null,
                mensaje: `Reporte generado para ${categoria.nombre}`
            };

        } catch (error) {
            this.logger.error("Error al generar reporte por categoría:", error);
            throw error;
        }
    }
}
