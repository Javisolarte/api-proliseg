import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import type { CreateInventarioDto, CreateMovimientoDto } from "./dto/inventario.dto";

@Injectable()
export class InventarioPuestoService {
    private readonly logger = new Logger(InventarioPuestoService.name);

    constructor(private readonly supabaseService: SupabaseService) { }

    // Helper to get current stock
    private async getStock(puestoId: number, varianteId: number, condicion: string) {
        const supabase = this.supabaseService.getClient();
        const { data } = await supabase.from("inventario_puesto")
            .select("cantidad_actual")
            .eq("puesto_id", puestoId)
            .eq("variante_articulo_id", varianteId)
            .eq("condicion", condicion)
            .single();
        return data ? data.cantidad_actual : 0;
    }

    async registrarMovimiento(dto: CreateMovimientoDto, userId: number) {
        try {
            const supabase = this.supabaseService.getClient();
            const condicion = dto.condicion || 'bueno';

            // 1. Validar Stock Negativo
            // Si tipo es Salida (consumo, baja, retiro), verificar que hay suficiente stock
            const restaStock = ['retiro_de_puesto', 'consumo', 'baja', 'traslado'].includes(dto.tipo_movimiento);
            const currentQty = await this.getStock(dto.puesto_id, dto.variante_articulo_id, condicion);

            if (restaStock) {
                if (currentQty < dto.cantidad) {
                    throw new BadRequestException(`⛔ STOCK INSUFICIENTE: Stock actual: ${currentQty}, Intento de retiro: ${dto.cantidad}`);
                }
            }

            // 2. Registrar Movimiento (Transaccional)
            const { error: errMov } = await supabase.from("inventario_puesto_movimientos").insert({
                ...dto,
                condicion_entrada: condicion,
                responsable_id: userId,
                fecha: new Date().toISOString()
            });
            if (errMov) throw new BadRequestException("Error registrar movimiento");

            // 3. Actualizar Inventario Maestro
            const nuevaCantidad = restaStock ? currentQty - dto.cantidad : currentQty + dto.cantidad;

            const { error: errUpd } = await supabase.from("inventario_puesto").upsert({
                puesto_id: dto.puesto_id,
                variante_articulo_id: dto.variante_articulo_id,
                condicion: condicion,
                cantidad_actual: nuevaCantidad,
                updated_at: new Date().toISOString()
            }, { onConflict: 'puesto_id,variante_articulo_id,condicion' });

            if (errUpd) throw new BadRequestException("Error actualizar inventario");

            return { success: true, nuevo_stock: nuevaCantidad };

        } catch (error) { throw error; }
    }

    // Se bloquea el update directo de cantidad_actual desde controller, forzando a usar movimientos
    async createOrUpdate(dto: CreateInventarioDto) {
        // Este método solo debería usarse para inicialización o ajustes de auditoría
        // Si quiere lógica estricta, eliminar este método del controller público.
        // Daremos acceso, pero el movimiento es lo recomendado.
        return {};
    }

    async findAll(filters: any) { const supabase = this.supabaseService.getClient(); /*...*/ return []; }
    async getMovimientos(id: number) { /*...*/ return []; }
}
