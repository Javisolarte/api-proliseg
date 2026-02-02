import { Injectable, Logger, BadRequestException, NotFoundException } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import type { CreateConsentimientoDto } from "./dto/consentimiento.dto";
import { DocumentosGeneradosService } from "../documentos-generados/documentos-generados.service";
import { EntidadTipo } from "../documentos-generados/dto/documento-generado.dto";

@Injectable()
export class ConsentimientosService {
    private readonly logger = new Logger(ConsentimientosService.name);

    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly documentosService: DocumentosGeneradosService
    ) { }

    async create(createDto: CreateConsentimientoDto) {
        try {
            const supabase = this.supabaseService.getClient();

            // 1. Validar reglas de negocio (Consentimiento Único por Tipo vigente)
            const { data: current } = await supabase
                .from("consentimientos_empleado")
                .select("id")
                .eq("empleado_id", createDto.empleado_id)
                .eq("tipo_consentimiento", createDto.tipo_consentimiento)
                .eq("vigente", true)
                .single();

            if (current) {
                // Revocar anterior
                await supabase.from("consentimientos_empleado").update({ vigente: false }).eq("id", current.id);
            }

            let documentoGeneradoId: number | null = createDto.documento_generado_id || null;
            let urlPdf: string | null = createDto.documento_pdf_url || null;

            // 2. Si se proporciona plantilla y NO hay documento generado previo, generar documento
            if (createDto.plantilla_id && !documentoGeneradoId) {
                // Obtener datos del empleado si no se pasan todos
                const { data: empleado } = await supabase.from('empleados').select('*').eq('id', createDto.empleado_id).single();

                const datos = createDto.datos_json || {};
                // Rellenar datos base si faltan y tenemos info del empleado
                if (empleado) {
                    if (!datos.nombre_completo) datos.nombre_completo = empleado.nombre_completo;
                    if (!datos.cedula) datos.cedula = empleado.cedula;
                    if (!datos.cargo) datos.cargo = empleado.cargo_oficial || 'Empleado';
                }

                const docGenerado = await this.documentosService.create({
                    plantilla_id: createDto.plantilla_id,
                    entidad_tipo: EntidadTipo.EMPLEADO, // El consentimiento es del empleado
                    entidad_id: createDto.empleado_id,
                    datos_json: datos
                }, { empleado_id: createDto.empleado_id }); // Pasamos contexto para posible auto-firma

                documentoGeneradoId = docGenerado.id;

                // Intentar generar PDF borrador inicial
                try {
                    const docConPdf = await this.documentosService.generarPdf(docGenerado.id);
                    urlPdf = docConPdf.url_pdf;
                } catch (e) {
                    this.logger.warn(`No se pudo generar PDF inicial para consentimiento ${docGenerado.id}: ${e.message}`);
                }
            }

            // 3. Crear registro de consentimiento
            const { data, error } = await supabase
                .from("consentimientos_empleado")
                .insert({
                    empleado_id: createDto.empleado_id,
                    tipo_consentimiento: createDto.tipo_consentimiento,
                    acepta: createDto.acepta ?? true,
                    fecha_consentimiento: new Date().toISOString(),
                    documento_pdf_url: urlPdf,
                    documento_generado_id: documentoGeneradoId,
                    vigente: true
                })
                .select()
                .single();

            // Si se creó documento generado, vincularlo (si no se pudo en insert directo)
            // if (documentoGeneradoId && data) { ... }

            if (error) throw new BadRequestException(`Error creando consentimiento: ${error.message}`);

            // Retornar estructura combinada para que el frontend sepa si debe mostrar firma
            return {
                ...data,
                documento_generado_id: documentoGeneradoId
            };

        } catch (error) { throw error; }
    }

    async update(id: number, updateDto: any) {
        try {
            const supabase = this.supabaseService.getClient();
            const { data, error } = await supabase
                .from("consentimientos_empleado")
                .update(updateDto)
                .eq("id", id)
                .select()
                .single();

            if (error) throw new BadRequestException(`Error actualizando consentimiento: ${error.message}`);
            return data;
        } catch (error) { throw error; }
    }

    async revocar(id: number) {
        const supabase = this.supabaseService.getClient();
        await supabase.from("consentimientos_empleado").update({ vigente: false, acepta: false }).eq("id", id);
        return { success: true };
    }

    async findAll(filters: { empleado_id?: number; tipo?: string }) {
        try {
            const supabase = this.supabaseService.getClient();
            let query = `
                SELECT c.id, 
                       c.empleado_id, 
                       c.tipo_consentimiento, 
                       c.acepta, 
                       c.fecha_consentimiento, 
                       c.datos_json, 
                       c.vigente, 
                       c.created_at, 
                       c.updated_at, 
                       c.documento_generado_id,
                       e.nombre_completo as empleado_nombre,
                       e.cedula as empleado_cedula,
                       dg.plantilla_id as plantilla_id,
                       COALESCE(dg.url_pdf, c.documento_pdf_url) as documento_pdf_url
                FROM consentimientos_empleado c
                LEFT JOIN empleados e ON c.empleado_id = e.id
                LEFT JOIN documentos_generados dg ON c.documento_generado_id = dg.id
                WHERE 1=1
            `;

            if (filters?.empleado_id) query += ` AND c.empleado_id = ${filters.empleado_id}`;
            if (filters?.tipo) query += ` AND c.tipo_consentimiento = '${filters.tipo}'`;

            query += ` ORDER BY c.created_at DESC`;

            const { data, error } = await supabase.rpc("exec_sql", { query });

            if (error) {
                this.logger.error("Error en findAll consentimientos:", error);
                throw new BadRequestException("Error al obtener consentimientos");
            }
            return Array.isArray(data) ? data : [];
        } catch (error) { throw error; }
    }

    async getByEmpleado(id: number) {
        return this.findAll({ empleado_id: id });
    }
}
