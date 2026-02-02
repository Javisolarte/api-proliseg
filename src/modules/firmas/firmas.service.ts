import { Injectable, Logger, BadRequestException, ConflictException, NotFoundException, Inject, forwardRef } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import type { CreateFirmaDto } from "./dto/firma.dto";
import { DocumentosGeneradosService } from "../documentos-generados/documentos-generados.service";

@Injectable()
export class FirmasService {
    private readonly logger = new Logger(FirmasService.name);

    constructor(
        private readonly supabaseService: SupabaseService,
        @Inject(forwardRef(() => DocumentosGeneradosService))
        private readonly documentosService: DocumentosGeneradosService
    ) { }

    async create(createDto: CreateFirmaDto, ipAddress: string) {
        try {
            const supabase = this.supabaseService.getClient();
            const docId = createDto.documento_id;

            // 1. Validar estado del documento
            const doc = await this.documentosService.findOne(docId);
            if (doc.estado !== 'pendiente_firmas') {
                throw new BadRequestException(`El documento no está pendiente de firmas (Estado: ${doc.estado})`);
            }

            // 2. Firma única: Verificar si este usuario ya firmó
            if (createDto.usuario_id) {
                const { data: existing } = await supabase
                    .from("firmas_documentos")
                    .select("id")
                    .eq("documento_id", docId)
                    .eq("usuario_id", createDto.usuario_id)
                    .single();

                if (existing) {
                    throw new ConflictException("El usuario ya ha firmado este documento");
                }
            }

            // 3. Orden secuencial (Si plantilla define orden - Implementación simplificada:
            // Se asume que el orden viene en el DTO o se infiere. Si es estricto:
            // Verificar si hay firmas pendientes con orden < orden_actual)
            // *Lógica implícita*: Si hay un array de firmantes esperados, validar turno.
            // (Como no tenemos tabla 'firmantes_esperados', validamos orden numérico simple si se provee)

            const orden = createDto.orden || 1;
            if (orden > 1) {
                const { count } = await supabase
                    .from("firmas_documentos")
                    .select("*", { count: "exact", head: true })
                    .eq("documento_id", docId)
                    .lt("orden", orden);

                // Si el orden es 2, debe haber al menos 1 firma anterior.
                // Nota: Esta lógica depende de definir firmantes esperados.
                // Si no se definen, es difícil validar "todas las anteriores".
                // Asumiremos validación simple: debe existir alguna firma previa si orden > 1
                if (count === 0) {
                    throw new BadRequestException(`No se puede firmar en orden ${orden} sin firmas previas.`);
                }
            }

            // 4. Registrar firma
            // Asegurar IP y user-agent (pasados desde controller)
            const { data, error } = await supabase
                .from("firmas_documentos")
                .insert({
                    documento_id: docId,
                    usuario_id: createDto.usuario_id || null,
                    empleado_id: createDto.empleado_id || null, // Link directo al empleado
                    nombre_firmante: createDto.nombre_firmante,
                    documento_identidad_firmante: createDto.documento_identidad_firmante,
                    cargo_firmante: createDto.cargo_firmante || null,
                    tipo_firma: createDto.tipo_firma,
                    firma_base64: createDto.firma_base64,
                    huella_base64: createDto.huella_base64 || null,
                    ip_address: ipAddress, // Obligatorio
                    orden: orden
                })
                .select()
                .single();

            if (error) throw new BadRequestException("Error al registrar firma");

            // 5. Cierre automático y RE-GENERACIÓN de PDF
            if (createDto.es_ultima_firma) {
                // Primero cambiamos a firmado
                await this.documentosService.cambiarEstado(docId, 'firmado');

                // Re-generamos el PDF para que incluya todas las firmas (incluyendo esta última)
                // Usamos un pequeño truco: pasamos temporalmente a generando_pdf para permitir el bypass de validación
                const supabase = this.supabaseService.getClient();
                await supabase.from("documentos_generados").update({ estado: 'borrador' }).eq("id", docId);
                await this.documentosService.generarPdf(docId);
                await supabase.from("documentos_generados").update({ estado: 'firmado' }).eq("id", docId);

                this.logger.log(`Documento ${docId} cerrado y PDF final re-generado tras última firma.`);
            }

            this.logger.log(`✅ Firma registrada para documento ${docId}`);
            return data;

        } catch (error) {
            this.logger.error("Error en create:", error);
            throw error;
        }
    }

    async verifyToken(token: string) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from("firmas_documentos")
            .select("*")
            .eq("token_validacion", token)
            .single();

        if (error || !data) throw new NotFoundException("Token de firma inválido");
        return { valido: true, firma: data };
    }

    // Métodos helper
    async findByDocumento(docId: number) {
        const supabase = this.supabaseService.getClient();
        const { data } = await supabase.from("firmas_documentos").select("*").eq("documento_id", docId).order('orden');
        return data || [];
    }

    async findOne(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from("firmas_documentos").select("*").eq("id", id).single();
        if (error) throw new NotFoundException("Firma no encontrada");
        return data;
    }

    async remove(id: number) {
        // Solo si documento no está cerrado
        const supabase = this.supabaseService.getClient();
        const { data: firma } = await supabase.from("firmas_documentos").select("documento_id").eq("id", id).single();
        if (firma) {
            const doc = await this.documentosService.findOne(firma.documento_id);
            if (doc.estado === 'firmado') throw new BadRequestException("No se puede eliminar firma de documento cerrado");
            await supabase.from("firmas_documentos").delete().eq("id", id);
            return { success: true };
        }
        throw new NotFoundException();
    }

    async reordenar(ordenes: { id: number, orden: number }[]) {
        const supabase = this.supabaseService.getClient();
        // Actualización secuencial
        for (const item of ordenes) {
            await supabase
                .from("firmas_documentos")
                .update({ orden: item.orden })
                .eq("id", item.id);
        }
        return { success: true, message: "Firmas reordenadas" };
    }

    async getEstadoFirmas(docId: number) {
        const firmas: any[] = await this.findByDocumento(docId);
        const total = firmas.length;
        const firmadas = firmas.filter(f => f.fecha_firma || f.estado === 'firmado').length;
        const pendientes = total - firmadas;

        return {
            documento_id: docId,
            total,
            firmadas,
            pendientes,
            completado: pendientes === 0 && total > 0,
            progreso_porcentaje: total > 0 ? Math.round((firmadas / total) * 100) : 0,
            detalle: firmas.map(f => ({
                id: f.id,
                nombre: f.nombre_firmante,
                cargo: f.cargo_firmante,
                estado: f.fecha_firma ? 'firmado' : 'pendiente',
                fecha_firma: f.fecha_firma,
                orden: f.orden
            }))
        };
    }

    /**
     * ✍️ AUTO-SIGN: Firma un documento usando la firma guardada del empleado
     */
    async autoSign(documentoId: number, empleadoId: number, ipAddress: string = '127.0.0.1') {
        const supabase = this.supabaseService.getClient();

        // 1. Obtener datos del empleado y su firma maestra
        const { data: empleado, error: empError } = await supabase
            .from('empleados')
            .select('id, nombre_completo, cedula, cargo_oficial, firma_digital_base64')
            .eq('id', empleadoId)
            .single();

        if (empError || !empleado?.firma_digital_base64) {
            this.logger.warn(`No se pudo auto-firmar: El empleado ${empleadoId} no tiene firma guardada.`);
            return null;
        }

        // 2. Crear el registro de firma
        return this.create({
            documento_id: documentoId,
            empleado_id: empleado.id,
            nombre_firmante: empleado.nombre_completo,
            documento_identidad_firmante: empleado.cedula,
            cargo_firmante: empleado.cargo_oficial || 'Administrador',
            tipo_firma: 'digital',
            firma_base64: empleado.firma_digital_base64,
            orden: 1, // Por defecto al principio
            es_ultima_firma: false // Dependerá del flujo
        }, ipAddress);
    }

    /**
     * 💾 GUARDAR FIRMA MAESTRA: Guarda la firma en el perfil del empleado
     */
    async saveMasterSignature(empleadoId: number, firmaBase64: string, cargo?: string) {
        const supabase = this.supabaseService.getClient();
        const updateData: any = { firma_digital_base64: firmaBase64 };
        if (cargo) updateData.cargo_oficial = cargo;

        const { data, error } = await supabase
            .from('empleados')
            .update(updateData)
            .eq('id', empleadoId)
            .select()
            .single();

        if (error) throw new BadRequestException("Error al guardar firma maestra del empleado");
        return data;
    }
}
