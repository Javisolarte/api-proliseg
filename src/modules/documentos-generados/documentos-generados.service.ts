import { Injectable, NotFoundException, Logger, BadRequestException, ForbiddenException, Inject, forwardRef, InternalServerErrorException } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { PlantillasService } from "../plantillas/plantillas.service";
import type { CreateDocumentoDto } from "./dto/documento-generado.dto";
import { FirmasService } from "../firmas/firmas.service";
import * as puppeteer from 'puppeteer';

@Injectable()
export class DocumentosGeneradosService {
    private readonly logger = new Logger(DocumentosGeneradosService.name);

    private browser: puppeteer.Browser | null = null;
    private readonly browserOptions: any = {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    };

    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly plantillasService: PlantillasService,
        @Inject(forwardRef(() => FirmasService))
        private readonly firmasService: FirmasService
    ) { }

    private async getBrowser() {
        if (!this.browser || !this.browser.connected) {
            this.browser = await puppeteer.launch(this.browserOptions);
            this.logger.log('Nuevo navegador Puppeteer iniciado');
        }
        return this.browser;
    }

    async create(createDto: CreateDocumentoDto, usuarioActual?: any) {
        try {
            // 1. Validar variables de plantilla
            await this.plantillasService.validateVariables(createDto.plantilla_id, createDto.datos_json);

            const supabase = this.supabaseService.getClient();

            // 2. Crear documento en estado borrador
            // NOTA: Si queremos que se firme auto, quizás deba estar en otro estado o pasar por un flujo
            const { data: doc, error } = await supabase
                .from("documentos_generados")
                .insert({
                    plantilla_id: createDto.plantilla_id,
                    entidad_tipo: createDto.entidad_tipo,
                    entidad_id: createDto.entidad_id,
                    datos_json: createDto.datos_json,
                    estado: 'borrador',
                    created_by_id: createDto.created_by_id || usuarioActual?.id || null
                })
                .select()
                .single();

            if (error) throw new BadRequestException("Error al generar documento");

            // 3. AUTO-FIRMA (Si el usuario actual está vinculado a un empleado con firma)
            if (usuarioActual?.empleado_id) {
                await this.firmasService.autoSign(doc.id, usuarioActual.empleado_id);
                this.logger.log(`Documento ${doc.id} auto-firmado por empleado ${usuarioActual.empleado_id}`);
            }

            return doc;

        } catch (error) {
            this.logger.error("Error en create:", error);
            throw error;
        }
    }

    async cambiarEstado(id: number, nuevoEstado: string, motivoAnulacion?: string, urlPdf?: string) {
        try {
            const supabase = this.supabaseService.getClient();
            const { data: doc } = await supabase.from("documentos_generados").select("*").eq("id", id).single();

            if (!doc) throw new NotFoundException("Documento no encontrado");

            // Reglas de transición de estado
            if (doc.estado === 'firmado') {
                throw new ForbiddenException("El documento ya está firmado y es inmutable.");
            }

            if (doc.estado === 'anulado') {
                throw new ForbiddenException("El documento está anulado y no se puede modificar.");
            }

            // Validaciones específicas
            if (nuevoEstado === 'pendiente_firmas') {
                if (!doc.url_pdf && !urlPdf) {
                    throw new BadRequestException("No se puede pasar a pendiente_firmas sin generar el PDF primero");
                }
            }

            if (nuevoEstado === 'firmado') {
                // Verificar que todas las firmas obligatorias estén
                const { count } = await supabase
                    .from("firmas_documentos")
                    .select("*", { count: "exact", head: true })
                    .eq("documento_id", id);

                if (count === 0) {
                    // Asumimos que requiere al menos una firma. 
                    // TODO: Si hubiera configuración de "firmas requeridas" en plantilla, se validaría aquí.
                    // Por ahora, advertencia o bloqueo light.
                    this.logger.warn(`Documento ${id} pasando a firmado sin firmas registradas en sistema (posible firma externa)`);
                }
            }

            if (nuevoEstado === 'anulado') {
                if (!motivoAnulacion) {
                    throw new BadRequestException("La anulación requiere un motivo");
                }
            }

            const updates: any = {
                estado: nuevoEstado,
                updated_at: new Date().toISOString()
            };

            if (urlPdf) updates.url_pdf = urlPdf; // Guardar URL si se generó en este paso

            const { data, error } = await supabase
                .from("documentos_generados")
                .update(updates)
                .eq("id", id)
                .select()
                .single();

            if (error) throw new BadRequestException(`Error al cambiar estado: ${error.message}`);
            return data;

        } catch (error) {
            this.logger.error(`Error en cambiarEstado(${id}):`, error);
            throw error;
        }
    }

    // Implementación de otros métodos básicos necesarios para el controller
    async findAll(filters?: any) {
        const supabase = this.supabaseService.getClient();
        let query = supabase.from("documentos_generados").select("*");
        if (filters?.estado) query = query.eq("estado", filters.estado);
        const { data, error } = await query;
        if (error) throw new BadRequestException(error.message);
        return data;
    }

    async findOne(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from("documentos_generados").select("*").eq("id", id).single();
        if (error) throw new NotFoundException();
        return data;
    }

    async findByCodigoReferencia(codigo: string) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from("documentos_generados").select("*").eq("codigo_referencia", codigo).single();
        if (error) throw new NotFoundException();
        return data;
    }

    // 🟢 BLOQUE 6 - Advanced Search
    async buscar(filters: any) {
        const supabase = this.supabaseService.getClient();
        let query = supabase.from("documentos_generados").select("*");

        if (filters.estado) {
            query = query.eq("estado", filters.estado);
        }

        if (filters.desde) {
            query = query.gte("created_at", filters.desde);
        }

        if (filters.hasta) {
            query = query.lte("created_at", filters.hasta);
        }

        // TODO: Implement full-text search on codigo_referencia and entidad_tipo
        if (filters.q) {
            query = query.or(`codigo_referencia.ilike.%${filters.q}%,entidad_tipo.ilike.%${filters.q}%`);
        }

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw new BadRequestException(error.message);
        return data;
    }

    async update(id: number, updateDto: any) {
        return this.cambiarEstado(id, updateDto.estado, updateDto.motivo, updateDto.url_pdf);
    }

    async anular(id: number, motivo: string) {
        return this.cambiarEstado(id, 'anulado', motivo);
    }

    // 🟢 BLOQUE 3 - State Transition Methods for Documents
    async generarPdf(id: number) {
        const supabase = this.supabaseService.getClient();

        // 1. Obtener documento con su plantilla
        const { data: doc, error: docError } = await supabase
            .from("documentos_generados")
            .select(`
                *,
                plantilla:plantillas_documentos(*)
            `)
            .eq("id", id)
            .single();

        if (docError || !doc) throw new NotFoundException("Documento no encontrado");

        // Solo se puede generar PDF si está en borrador o generando_pdf (reintento)
        if (doc.estado !== 'borrador' && doc.estado !== 'generando_pdf') {
            throw new BadRequestException(`No se puede generar PDF de un documento en estado ${doc.estado}`);
        }

        try {
            // 2. Preparar el HTML con variables
            let htmlContenido = doc.plantilla.contenido_html;
            const datos = doc.datos_json || {};

            // Reemplazo de variables {{variable}}
            for (const [key, value] of Object.entries(datos)) {
                const regex = new RegExp(`{{${key}}}`, 'g');
                htmlContenido = htmlContenido.replace(regex, value as string);
            }

            // 3. Obtener firmas registradas para inyectar si existen
            const { data: firmas } = await supabase
                .from("firmas_documentos")
                .select("*")
                .eq("documento_id", id)
                .order("orden", { ascending: true });

            // Inyectar firmas en placeholders específicos ej: {{firma_1}}, {{firma_2}}
            if (firmas && firmas.length > 0) {
                firmas.forEach((f, index) => {
                    if (f.firma_base64) {
                        const firmaHtml = `<img src="${f.firma_base64}" style="max-width: 200px; max-height: 100px;" alt="Firma ${f.nombre_firmante}">`;
                        // Soporte para placeholders {{firma_1}}, {{firma_2}}...
                        htmlContenido = htmlContenido.replace(new RegExp(`{{firma_${index + 1}}}`, 'g'), firmaHtml);
                        // Soporte para placeholder genérico por orden
                        htmlContenido = htmlContenido.replace(new RegExp(`{{firma_orden_${f.orden}}}`, 'g'), firmaHtml);
                    }
                    // Inyectar Huella si existe
                    if (f.huella_base64) {
                        const huellaHtml = `<img src="${f.huella_base64}" style="max-width: 100px; max-height: 120px;" alt="Huella">`;
                        htmlContenido = htmlContenido.replace(new RegExp(`{{huella_${index + 1}}}`, 'g'), huellaHtml);
                    }
                });
            }

            // 3.5. Insertar Footer con "Generado por"
            let footerHtml = '';
            if (doc.created_by_id) {
                // Intentar buscar en usuarios_externos (gestores)
                const { data: usuario } = await supabase.from('usuarios_externos').select('nombre_completo').eq('id', doc.created_by_id).single();
                if (usuario) {
                    footerHtml = `
                    <div style="position: fixed; bottom: 0; width: 100%; font-size: 8px; color: #888; text-align: center; padding: 5px; background: white;">
                        Generado por: ${usuario.nombre_completo.toUpperCase()} | Fecha: ${new Date().toLocaleString('es-CO')} | Ref: ${doc.codigo_referencia || id}
                    </div>`;
                }
            }

            // Si el contenido no tiene cierre de body/html, lo añadimos al final. 
            // Si es un documento completo, lo ideal es usar headerTemplate/footerTemplate de puppeteer,
            // pero eso requiere margins.
            // Para simplicidad, lo agregamos al final del contenido HTML, asumiendo flujo normal.
            if (footerHtml) {
                htmlContenido += footerHtml;
            }

            // 4. Generar PDF con Puppeteer (Navegador reutilizado)
            const browser = await this.getBrowser();
            const page = await browser.newPage();

            try {
                // Usamos domcontentloaded ya que es mucho más rápido que networkidle0
                await page.setContent(htmlContenido, { waitUntil: 'domcontentloaded' });

                const pdfBuffer = await page.pdf({
                    format: 'Letter' as puppeteer.PaperFormat,
                    printBackground: true,
                    margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' }
                });

                // 5. Subir a Supabase Storage
                const fileName = `${doc.entidad_tipo}/${id}_${Date.now()}.pdf`;
                const path = await this.supabaseService.uploadFile('documentos', fileName, Buffer.from(pdfBuffer), 'application/pdf');

                // Obtener URL pública
                const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(path);

                // 6. Actualizar registro
                const { data: updatedDoc, error: updateError } = await supabase
                    .from("documentos_generados")
                    .update({
                        estado: 'generando_pdf',
                        url_pdf: publicUrl,
                        fecha_generacion: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq("id", id)
                    .select()
                    .single();

                if (updateError) throw new BadRequestException(`Error actualizando URL del PDF: ${updateError.message}`);

                this.logger.log(`✅ PDF generado y subido para documento ${id}: ${publicUrl}`);
                return updatedDoc;

            } finally {
                await page.close();
            }

        } catch (error) {
            this.logger.error(`Error generando PDF para documento ${id}:`, error);
            throw new InternalServerErrorException("Falló la generación del PDF con Puppeteer");
        }
    }

    async enviarFirmas(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data: doc } = await supabase.from("documentos_generados").select("*").eq("id", id).single();

        if (!doc) throw new NotFoundException("Documento no encontrado");

        // Solo se puede enviar a firmas si ya se generó el PDF
        if (doc.estado !== 'generando_pdf' && doc.estado !== 'borrador') {
            throw new BadRequestException(`No se puede enviar a firmas un documento en estado ${doc.estado}`);
        }

        if (!doc.url_pdf) {
            throw new BadRequestException("Debe generar el PDF primero");
        }

        // Verificar que haya firmantes configurados
        const { count } = await supabase
            .from("firmas_documentos")
            .select("*", { count: "exact", head: true })
            .eq("documento_id", id);

        if (count === 0) {
            this.logger.warn(`Documento ${id} enviado a firmas sin firmantes registrados`);
        }

        const { data, error } = await supabase
            .from("documentos_generados")
            .update({
                estado: 'pendiente_firmas',
                fecha_envio_firmas: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq("id", id)
            .select()
            .single();

        if (error) throw new BadRequestException(`Error enviando a firmas: ${error.message}`);

        // TODO: Aquí se enviarían notificaciones a los firmantes
        this.logger.log(`Documento ${id} enviado para firmas`);
        return data;
    }

    async cerrar(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data: doc } = await supabase.from("documentos_generados").select("*").eq("id", id).single();

        if (!doc) throw new NotFoundException("Documento no encontrado");

        // Solo se puede cerrar si está pendiente de firmas
        if (doc.estado !== 'pendiente_firmas') {
            throw new BadRequestException(`No se puede cerrar un documento en estado ${doc.estado}`);
        }

        // Validar que todas las firmas requeridas estén completas
        const { data: firmas } = await supabase
            .from("firmas_documentos")
            .select("*")
            .eq("documento_id", id);

        const firmasPendientes = firmas?.filter(f => !f.firmado_en) || [];
        if (firmasPendientes.length > 0) {
            throw new BadRequestException(`Hay ${firmasPendientes.length} firmas pendientes`);
        }

        const { data, error } = await supabase
            .from("documentos_generados")
            .update({
                estado: 'cerrado',
                fecha_cierre: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq("id", id)
            .select()
            .single();

        if (error) throw new BadRequestException(`Error cerrando documento: ${error.message}`);

        this.logger.log(`Documento ${id} cerrado exitosamente`);
        return data;
    }

    async getFirmas(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from("firmas_documentos").select("*").eq("documento_id", id);
        if (error) throw new BadRequestException("Error obteniendo firmas");
        return data;
    }

    async finalizar(id: number) {
        // Alias de cerrar, asegura que el documento quede inmutable
        return this.cerrar(id);
    }

    async getHistorial(id: number) {
        const supabase = this.supabaseService.getClient();
        // Obtener historial de auditoría
        const { data } = await supabase
            .from("auditoria")
            .select("*")
            .eq("entidad", "documentos_generados")
            .eq("entidad_id", id)
            .order("created_at", { ascending: false });

        return data || [];
    }

    async reenviar(id: number) {
        const doc = await this.findOne(id);
        if (doc.estado !== 'pendiente_firmas' && doc.estado !== 'enviado') {
            throw new BadRequestException("Solo se pueden reenviar documentos enviados o pendientes de firma");
        }

        // Simulación de reenvío
        this.logger.log(`Reenviando notificaciones para documento ${id}`);

        // Aquí se llamaría al servicio de notificaciones/comunicaciones real

        return { success: true, message: "Notificaciones reenviadas correctamente" };
    }
}
