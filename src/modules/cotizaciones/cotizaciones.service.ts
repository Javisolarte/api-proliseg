import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import type { CreateCotizacionDto, UpdateCotizacionDto, CreateCotizacionItemDto as CreateItemDto } from "./dto/cotizacion.dto";
import { DocumentosGeneradosService } from "../documentos-generados/documentos-generados.service";
import { EntidadTipo } from "../documentos-generados/dto/documento-generado.dto";

@Injectable()
export class CotizacionesService {
    private readonly logger = new Logger(CotizacionesService.name);

    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly documentosService: DocumentosGeneradosService
    ) { }

    // Helper para recalcular totales
    private async recalcularTotales(cotizacionId: number) {
        const supabase = this.supabaseService.getClient();

        // Obtener todos los items
        const { data: items } = await supabase
            .from("cotizaciones_items")
            .select("total_linea")
            .eq("cotizacion_id", cotizacionId);

        if (!items) return;

        const subtotal = items.reduce((sum, item) => sum + Number(item.total_linea), 0);
        const impuestos = subtotal * 0.19; // TODO: Parametrizar IVA si aplica
        const total = subtotal + impuestos;

        // Actualizar cabecera
        await supabase
            .from("cotizaciones")
            .update({ subtotal, impuestos, total, updated_at: new Date().toISOString() })
            .eq("id", cotizacionId);

        this.logger.log(`Totales recalculados cotizacion ${cotizacionId}: ${total}`);
    }

    async create(createDto: CreateCotizacionDto, user: any) {
        const userId = typeof user === 'number' ? user : user.id;
        try {
            const supabase = this.supabaseService.getClient();
            const { data, error } = await supabase.from("cotizaciones").insert({
                cliente_id: createDto.cliente_id,
                prospecto_datos: createDto.prospecto_datos,
                fecha_emision: createDto.fecha_emision || new Date().toISOString(),
                fecha_vencimiento: createDto.fecha_vencimiento,
                subtotal: createDto.subtotal,
                impuestos: createDto.impuestos,
                total: createDto.total,
                observaciones: createDto.observaciones,
                creado_por: userId,
                estado: 'borrador',
            }).select().single();

            if (error) throw new BadRequestException(error.message);

            // Si se pasa plantilla, crear el documento vinculado
            if (createDto.plantilla_id) {
                const docGenerado = await this.documentosService.create({
                    plantilla_id: createDto.plantilla_id,
                    entidad_tipo: EntidadTipo.CLIENTE, // O crear un nuevo EntidadTipo.COTIZACION si es necesario
                    entidad_id: data.id,
                    datos_json: {
                        ...createDto,
                        total_texto: "CIEN MIL PESOS", // Podríamos añadir una utilidad luego
                    }
                }, typeof user === 'object' ? user : undefined);

                await supabase.from("cotizaciones").update({ documento_generado_id: docGenerado.id }).eq("id", data.id);
            }

            return data;
        } catch (e) { throw e; }
    }

    async update(id: number, updateDto: UpdateCotizacionDto, userId: number) {
        try {
            const supabase = this.supabaseService.getClient();

            // 1. Validar inmutabilidad
            const { data: current } = await supabase.from("cotizaciones").select("estado").eq("id", id).single();
            if (!current) throw new NotFoundException();

            if (['aprobada', 'rechazada', 'vencida'].includes(current.estado)) {
                throw new ForbiddenException(`No se puede editar una cotización en estado ${current.estado}`);
            }

            const { data, error } = await supabase
                .from("cotizaciones")
                .update({ ...updateDto, updated_at: new Date().toISOString() })
                .eq("id", id)
                .select()
                .single();

            if (error) throw new BadRequestException("Error al actualizar");
            return data;
        } catch (error) {
            this.logger.error("Error update:", error);
            throw error;
        }
    }

    async createItem(cotizacionId: number, itemDto: CreateItemDto) {
        try {
            const supabase = this.supabaseService.getClient();

            // 1. Validar bloqueo
            const { data: current } = await supabase.from("cotizaciones").select("estado").eq("id", cotizacionId).single();
            if (current && ['aprobada', 'rechazada', 'vencida'].includes(current.estado)) {
                throw new ForbiddenException("Cotización bloqueada");
            }

            // 2. Calcular total linea
            const total_linea = itemDto.cantidad * itemDto.valor_unitario;

            const { error } = await supabase.from("cotizaciones_items").insert({
                ...itemDto,
                cotizacion_id: cotizacionId,
                total_linea
            });

            if (error) throw new BadRequestException("Error agregando item");

            // 3. Trigger recálculo
            await this.recalcularTotales(cotizacionId);

            return { success: true };
        } catch (error) { throw error; }
    }

    async deleteItem(itemId: number) {
        const supabase = this.supabaseService.getClient();
        const { error } = await supabase.from("cotizaciones_items").delete().eq("id", itemId);
        if (error) throw new BadRequestException("Error eliminando item");
        return { success: true };
    }

    async aprobar(id: number, userId: number) {
        const supabase = this.supabaseService.getClient();
        const { data: current } = await supabase.from("cotizaciones").select("*").eq("id", id).single();

        if (!current) throw new NotFoundException("Cotización no encontrada");

        if (current.estado !== 'en_proceso' && current.estado !== 'borrador') {
            throw new BadRequestException("Estado inválido para aprobar");
        }

        // Cambio de estado
        const { data, error } = await supabase.from("cotizaciones")
            .update({ estado: 'aprobada', aprobado_por: userId, updated_at: new Date().toISOString() })
            .eq("id", id)
            .select().single();

        // TODO: (Futuro) Disparar creación de contrato automático aquí si se requiere

        if (error) throw new BadRequestException();
        return data;
    }

    // 🟢 BLOQUE 3 - State Transition Methods
    async enviar(id: number, userId: number) {
        const supabase = this.supabaseService.getClient();
        const { data: current } = await supabase.from("cotizaciones").select("*").eq("id", id).single();

        if (!current) throw new NotFoundException("Cotización no encontrada");

        // Solo se puede enviar si está en borrador
        if (current.estado !== 'borrador') {
            throw new BadRequestException(`No se puede enviar una cotización en estado ${current.estado}`);
        }

        // Validar que tenga items
        const { count } = await supabase.from("cotizaciones_items")
            .select("*", { count: 'exact', head: true })
            .eq("cotizacion_id", id);

        if (!count || count === 0) {
            throw new BadRequestException("La cotización debe tener al menos un item");
        }

        // Generar token público para acceso sin login (BLOQUE 4)
        const crypto = require('crypto');
        const publicToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // 30 días

        const { data, error } = await supabase.from("cotizaciones")
            .update({
                estado: 'enviada',
                fecha_envio: new Date().toISOString(),
                public_token: publicToken,
                public_token_expires_at: expiresAt.toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq("id", id)
            .select().single();

        if (error) throw new BadRequestException(error.message);

        this.logger.log(`Cotización ${id} enviada con token público`);
        return data;
    }

    async aceptar(id: number, userId: number) {
        const supabase = this.supabaseService.getClient();
        const { data: current } = await supabase.from("cotizaciones").select("*").eq("id", id).single();

        if (!current) throw new NotFoundException("Cotización no encontrada");

        // Solo se puede aceptar si está enviada y no expirada
        if (current.estado !== 'enviada') {
            throw new BadRequestException(`No se puede aceptar una cotización en estado ${current.estado}`);
        }

        // Validar que no esté expirada
        if (current.fecha_vencimiento && new Date(current.fecha_vencimiento) < new Date()) {
            throw new BadRequestException("La cotización está expirada");
        }

        const { data, error } = await supabase.from("cotizaciones")
            .update({
                estado: 'aceptada',
                fecha_aceptacion: new Date().toISOString(),
                aprobado_por: userId,
                updated_at: new Date().toISOString()
            })
            .eq("id", id)
            .select().single();

        if (error) throw new BadRequestException(error.message);

        // TODO: Disparar proceso de creación de contrato o siguiente workflow
        this.logger.log(`Cotización ${id} aceptada por usuario ${userId}`);
        return data;
    }

    async rechazar(id: number, motivo: string, userId: number) {
        const supabase = this.supabaseService.getClient();
        const { data: current } = await supabase.from("cotizaciones").select("*").eq("id", id).single();

        if (!current) throw new NotFoundException("Cotización no encontrada");

        // Solo se puede rechazar si está enviada
        if (current.estado !== 'enviada') {
            throw new BadRequestException(`No se puede rechazar una cotización en estado ${current.estado}`);
        }

        const { data, error } = await supabase.from("cotizaciones")
            .update({
                estado: 'rechazada',
                motivo_rechazo: motivo || 'Sin motivo especificado',
                fecha_rechazo: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq("id", id)
            .select().single();

        if (error) throw new BadRequestException(error.message);

        this.logger.log(`Cotización ${id} rechazada. Motivo: ${motivo}`);
        return data;
    }

    async expirar(id: number, userId: number) {
        const supabase = this.supabaseService.getClient();
        const { data: current } = await supabase.from("cotizaciones").select("*").eq("id", id).single();

        if (!current) throw new NotFoundException("Cotización no encontrada");

        // Solo se puede expirar si está enviada
        if (current.estado !== 'enviada') {
            throw new BadRequestException(`No se puede expirar una cotización en estado ${current.estado}`);
        }

        const { data, error } = await supabase.from("cotizaciones")
            .update({
                estado: 'expirada',
                fecha_expiracion: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq("id", id)
            .select().single();

        if (error) throw new BadRequestException(error.message);

        this.logger.log(`Cotización ${id} expirada`);
        return data;
    }

    // implementar cron para vencimiento automatico (simulado aqui con check manual)
    async checkVencimiento(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data } = await supabase.from("cotizaciones").select("fecha_vencimiento").eq("id", id).single();
        if (data && data.fecha_vencimiento && new Date(data.fecha_vencimiento) < new Date()) {
            await supabase.from("cotizaciones").update({ estado: 'vencida' }).eq("id", id);
        }
    }

    // Resto de métodos estándar...
    async findAll(filters?: any) {
        const supabase = this.supabaseService.getClient();
        // ... implementar filtros
        const { data } = await supabase.from("cotizaciones").select("*");
        return data || [];
    }
    async findOne(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data } = await supabase.from("cotizaciones").select("*, items:cotizaciones_items(*)").eq("id", id).single();
        return data;
    }
    async getItems(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data } = await supabase.from("cotizaciones_items").select("*").eq("cotizacion_id", id);
        return data;
    }

    async convertirAContrato(id: number, userId: number) {
        const supabase = this.supabaseService.getClient();
        // 1. Obtener datos completos
        const cotizacion = await this.findOne(id);

        if (!cotizacion) throw new NotFoundException("Cotización no encontrada");
        if (cotizacion.estado !== 'aceptada' && cotizacion.estado !== 'aprobada') {
            throw new BadRequestException("Solo cotizaciones aceptadas/aprobadas pueden convertirse a contrato");
        }

        // 2. Crear contrato (Simulación: Asumiendo tabla contratos existe y tiene estructura compatible)
        // En producción mapearíamos todos los campos requeridos
        const { data: contrato, error } = await supabase
            .from("contratos")
            .insert({
                cliente_id: cotizacion.cliente_id,
                fecha_inicio: new Date().toISOString(),
                // fecha_fin: calculada...
                valor_mensual: cotizacion.total, // O subtotal dependiendo de regla de negocio
                estado: 'borrador', // Inicia como borrador para revisión final
                creado_por: userId,
                origen_cotizacion_id: id
            })
            .select()
            .single();

        if (error) {
            this.logger.error("Error creando contrato desde cotización:", error);
            throw new BadRequestException("Error al generar contrato: " + error.message);
        }

        // 3. Modificar estado cotización para reflejar conversion
        await supabase
            .from("cotizaciones")
            .update({ estado: 'convertida', contrato_id: contrato.id }) // Asumiendo campo
            .eq("id", id);

        this.logger.log(`Cotización ${id} convertida a contrato ${contrato.id}`);
        return contrato;
    }

    async generarPdf(id: number) {
        const cotizacion = await this.findOne(id);
        if (!cotizacion) throw new NotFoundException("Cotización no encontrada");

        // Si tiene un documento generado vinculado, usamos ese motor
        if (cotizacion.documento_generado_id) {
            return this.documentosService.generarPdf(cotizacion.documento_generado_id);
        }

        // Si no tiene, por ahora lanzamos error indicando que requiere plantilla
        // O podríamos implementar un generador genérico de emergencia aquí
        throw new BadRequestException("Esta cotización no tiene una plantilla vinculada. Vincule una plantilla al crearla para habilitar la generación de PDF.");
    }
}
