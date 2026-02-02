import { Injectable, Logger, BadRequestException, NotFoundException } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import type { CreateVerificacionDto, CreateReferenciaDetalleDto } from "./dto/verificacion.dto";

@Injectable()
export class VerificacionReferenciasService {
    private readonly logger = new Logger(VerificacionReferenciasService.name);

    constructor(private readonly supabaseService: SupabaseService) { }

    async findAll(filters?: { aspirante_id?: number; empleado_id?: number; estado?: string }) {
        try {
            const supabase = this.supabaseService.getClient();
            let query = `
                SELECT vr.id, 
                       vr.aspirante_id, 
                       vr.empleado_id, 
                       vr.responsable_verificacion, 
                       vr.estado, 
                       vr.documento_final_id, 
                       vr.conclusiones, 
                       vr.created_at,
                       a.nombre_completo as aspirante_nombre,
                       e.nombre_completo as empleado_nombre,
                       u.nombre_completo as responsable_nombre,
                       dg.url_pdf as documento_pdf_url
                FROM verificacion_referencias vr
                LEFT JOIN aspirantes a ON vr.aspirante_id = a.id
                LEFT JOIN empleados e ON vr.empleado_id = e.id
                LEFT JOIN usuarios_externos u ON vr.responsable_verificacion = u.id
                LEFT JOIN documentos_generados dg ON vr.documento_final_id = dg.id
                WHERE 1=1
      `;

            if (filters?.aspirante_id) query += ` AND vr.aspirante_id = ${filters.aspirante_id}`;
            if (filters?.empleado_id) query += ` AND vr.empleado_id = ${filters.empleado_id}`;
            if (filters?.estado) query += ` AND vr.estado = '${filters.estado}'`;

            query += ` ORDER BY vr.created_at DESC`;

            const { data, error } = await supabase.rpc("exec_sql", { query });

            if (error) throw new BadRequestException("Error al obtener verificaciones");
            return Array.isArray(data) ? data : [];
        } catch (error) {
            this.logger.error("Error en findAll:", error);
            throw error;
        }
    }

    async findOne(id: number) {
        try {
            const supabase = this.supabaseService.getClient();
            const query = `
                SELECT vr.id,
                       vr.aspirante_id,
                       vr.empleado_id,
                       vr.responsable_verificacion,
                       vr.estado,
                       vr.documento_final_id,
                       vr.conclusiones,
                       vr.created_at,
                       a.nombre_completo as aspirante_nombre,
                       e.nombre_completo as empleado_nombre
                FROM verificacion_referencias vr
                LEFT JOIN aspirantes a ON vr.aspirante_id = a.id
                LEFT JOIN empleados e ON vr.empleado_id = e.id
                WHERE vr.id = ${id}
      `;

            const { data, error } = await supabase.rpc("exec_sql", { query });

            if (error) throw new BadRequestException("Error al obtener verificación");
            const result = Array.isArray(data) ? data : [];
            if (result.length === 0) throw new NotFoundException(`Verificación ${id} no encontrada`);

            return result[0];
        } catch (error) {
            this.logger.error(`Error en findOne(${id}):`, error);
            throw error;
        }
    }

    async create(createDto: CreateVerificacionDto, userId: number) {
        try {
            const supabase = this.supabaseService.getClient();

            const { data, error } = await supabase
                .from("verificacion_referencias")
                .insert({
                    aspirante_id: createDto.aspirante_id || null,
                    empleado_id: createDto.empleado_id || null,
                    responsable_verificacion: userId,
                    estado: 'en_proceso',
                })
                .select()
                .single();

            if (error) throw new BadRequestException("Error al crear verificación");

            this.logger.log(`✅ Verificación creada: ${data.id}`);
            return data;
        } catch (error) {
            this.logger.error("Error en create:", error);
            throw error;
        }
    }

    async finalizar(id: number, conclusiones: string, documentoId?: number) {
        try {
            const supabase = this.supabaseService.getClient();

            const { data, error } = await supabase
                .from("verificacion_referencias")
                .update({
                    estado: 'finalizado',
                    conclusiones,
                    documento_final_id: documentoId || null,
                })
                .eq("id", id)
                .select()
                .single();

            if (error) throw new BadRequestException("Error al finalizar verificación");

            this.logger.log(`✅ Verificación ${id} finalizada`);
            return data;
        } catch (error) {
            this.logger.error(`Error en finalizar(${id}):`, error);
            throw error;
        }
    }

    async finalizarConDocumento(
        id: number,
        conclusiones: string,
        datosReferencias: any,
        plantillaId?: number
    ) {
        try {
            const supabase = this.supabaseService.getClient();

            // 1. Obtener verificación y datos de la persona
            const verificacion = await this.findOne(id);
            if (!verificacion) {
                throw new NotFoundException(`Verificación ${id} no encontrada`);
            }

            let documentoGeneradoId: number | null = null;
            let urlPdf: string | null = null;

            // 2. Si se proporciona plantilla, generar documento
            if (plantillaId) {
                // Preparar datos para la plantilla
                const datos_json = {
                    fecha: new Date().toLocaleDateString('es-ES'),
                    cargo_ocupar: datosReferencias.cargo_ocupar || 'N/A',
                    nombre_candidato: verificacion.aspirante_nombre || verificacion.empleado_nombre || 'N/A',
                    referencias_laborales: datosReferencias.referencias_laborales || [],
                    referencias_personales: datosReferencias.referencias_personales || [],
                    hallazgos: datosReferencias.hallazgos || '',
                    conclusiones: conclusiones,
                    responsable_nombre: verificacion.responsable_nombre || 'N/A'
                };

                // Determinar entidad
                const entidad_tipo = verificacion.aspirante_id ? 'aspirante' : 'empleado';
                const entidad_id = verificacion.aspirante_id || verificacion.empleado_id;

                // Crear documento generado
                const { data: docGenerado, error: docError } = await supabase
                    .from('documentos_generados')
                    .insert({
                        plantilla_id: plantillaId,
                        entidad_tipo,
                        entidad_id,
                        datos_json,
                        estado: 'borrador'
                    })
                    .select()
                    .single();

                if (docError) {
                    this.logger.error('Error creando documento:', docError);
                    throw new BadRequestException('Error al crear documento');
                }

                documentoGeneradoId = docGenerado.id;

                // Intentar generar PDF inicial (sin firma)
                try {
                    // Aquí se puede llamar al servicio de generación de PDF
                    // const pdfResult = await this.documentosGeneradosService.generarPdf(documentoGeneradoId);
                    // urlPdf = pdfResult.url_pdf;
                    this.logger.log(`Documento ${documentoGeneradoId} creado, pendiente de generación PDF`);
                } catch (e) {
                    this.logger.warn(`No se pudo generar PDF inicial: ${e.message}`);
                }
            }

            // 3. Actualizar verificación con conclusiones y documento
            const { data, error } = await supabase
                .from("verificacion_referencias")
                .update({
                    estado: 'finalizado',
                    conclusiones,
                    documento_final_id: documentoGeneradoId,
                })
                .eq("id", id)
                .select()
                .single();

            if (error) throw new BadRequestException("Error al finalizar verificación");

            this.logger.log(`✅ Verificación ${id} finalizada con documento ${documentoGeneradoId}`);
            return {
                ...data,
                documento_generado_id: documentoGeneradoId,
                url_pdf: urlPdf
            };
        } catch (error) {
            this.logger.error(`Error en finalizarConDocumento(${id}):`, error);
            throw error;
        }
    }

    async getDetalles(verificacionId: number) {
        try {
            const supabase = this.supabaseService.getClient();
            const { data, error } = await supabase
                .from("referencias_detalles")
                .select("*")
                .eq("verificacion_id", verificacionId)
                .order("created_at", { ascending: true });

            if (error) throw new BadRequestException("Error al obtener detalles");
            return data || [];
        } catch (error) {
            this.logger.error(`Error en getDetalles(${verificacionId}):`, error);
            throw error;
        }
    }

    async createDetalle(createDto: CreateReferenciaDetalleDto) {
        try {
            const supabase = this.supabaseService.getClient();

            const { data, error } = await supabase
                .from("referencias_detalles")
                .insert({
                    verificacion_id: createDto.verificacion_id,
                    tipo_referencia: createDto.tipo_referencia,
                    nombre_contacto: createDto.nombre_contacto || null,
                    empresa_institucion: createDto.empresa_institucion || null,
                    telefono: createDto.telefono || null,
                    resultado_verificacion: createDto.resultado_verificacion || null,
                    es_valida: createDto.es_valida !== undefined ? createDto.es_valida : false,
                    observaciones: createDto.observaciones || null,
                })
                .select()
                .single();

            if (error) throw new BadRequestException("Error al crear detalle de referencia");

            // Si hay referencias con hallazgos, actualizar estado de verificación
            if (createDto.es_valida === false) {
                await supabase
                    .from("verificacion_referencias")
                    .update({ estado: 'con_hallazgos' })
                    .eq("id", createDto.verificacion_id)
                    .eq("estado", "en_proceso");
            }

            this.logger.log(`✅ Detalle de referencia creado: ${data.id}`);
            return data;
        } catch (error) {
            this.logger.error("Error en createDetalle:", error);
            throw error;
        }
    }
}
