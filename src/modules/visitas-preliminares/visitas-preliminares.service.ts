import { Injectable, Logger, BadRequestException, NotFoundException } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import type { CreateVisitaPreliminarDto, UpdateVisitaPreliminarDto } from "./dto/visita-preliminar.dto";
import { DocumentosGeneradosService } from "../documentos-generados/documentos-generados.service";
import { EntidadTipo } from "../documentos-generados/dto/documento-generado.dto";

@Injectable()
export class VisitasPreliminareService {
    private readonly logger = new Logger(VisitasPreliminareService.name);

    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly documentosService: DocumentosGeneradosService,
    ) { }

    async uploadEvidenciaToStorage(file: any, folder: string, filenameId: string): Promise<string> {
        const bucket = 'evidencias-preliminares';
        const supabase = this.supabaseService.getSupabaseAdminClient();
        const ext = file.originalname.split('.').pop() || 'jpg';
        const path = `${folder}/${filenameId}_${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from(bucket).upload(path, file.buffer, { contentType: file.mimetype, upsert: true });
        if (error) { this.logger.error(`❌ Error subiendo evidencia: ${JSON.stringify(error)}`); throw error; }
        const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(path);
        return publicUrlData.publicUrl;
    }

    async findAll(filters?: { cliente_potencial_id?: string; estado?: string }) {
        try {
            const supabase = this.supabaseService.getClient();
            let query = supabase.from('visitas_preliminares').select(`
                *,
                clientes_potenciales ( id, nombre_empresa, direccion, contacto, telefono )
            `).order('created_at', { ascending: false });

            if (filters?.cliente_potencial_id) query = query.eq('cliente_potencial_id', filters.cliente_potencial_id);
            if (filters?.estado) query = query.eq('estado', filters.estado);

            const { data, error } = await query;
            if (error) { this.logger.error("Error findAll:", error); throw new BadRequestException(`Error: ${error.message}`); }

            // Enrich with asignado_a_nombre
            if (data && data.length > 0) {
                const userIds = [...new Set(data.filter(d => d.asignado_a).map(d => d.asignado_a))];
                if (userIds.length > 0) {
                    const { data: usuarios } = await supabase.from('usuarios_externos').select('id, nombre_completo').in('id', userIds);
                    const userMap = new Map((usuarios || []).map(u => [u.id, u.nombre_completo]));
                    data.forEach(d => { if (d.asignado_a) d.asignado_a_nombre = userMap.get(d.asignado_a) || null; });
                }
                const solUserIds = [...new Set(data.filter(d => d.solicitado_por_id && d.solicitado_por_tipo === 'usuario').map(d => d.solicitado_por_id))];
                if (solUserIds.length > 0) {
                    const { data: solUsuarios } = await supabase.from('usuarios_externos').select('id, nombre_completo').in('id', solUserIds);
                    const solMap = new Map((solUsuarios || []).map(u => [u.id, u.nombre_completo]));
                    data.forEach(d => { if (d.solicitado_por_tipo === 'usuario' && d.solicitado_por_id) d.solicitado_por_nombre = solMap.get(d.solicitado_por_id) || 'Interno'; });
                }
            }
            return data || [];
        } catch (error) { this.logger.error("Error en findAll:", error); throw error; }
    }

    async findOne(id: string) {
        try {
            const supabase = this.supabaseService.getClient();
            const { data, error } = await supabase.from('visitas_preliminares').select(`*, clientes_potenciales ( id, nombre_empresa, direccion, contacto, telefono )`).eq('id', id).single();
            if (error) throw new NotFoundException(`Visita preliminar ${id} no encontrada`);

            // Enrich
            if (data.asignado_a) {
                const { data: u } = await supabase.from('usuarios_externos').select('id, nombre_completo').eq('id', data.asignado_a).single();
                if (u) data.asignado_a_nombre = u.nombre_completo;
                const { data: emp } = await supabase.from('empleados').select('cargo_oficial, firma_digital_base64').eq('usuario_id', data.asignado_a).single();
                if (emp) { data.tecnico_cargo = emp.cargo_oficial; data.tecnico_perfil_firma = emp.firma_digital_base64; }
            }
            if (data.solicitado_por_id && data.solicitado_por_tipo === 'usuario') {
                const { data: su } = await supabase.from('usuarios_externos').select('id, nombre_completo').eq('id', data.solicitado_por_id).single();
                if (su) data.solicitado_por_nombre = su.nombre_completo;
            }
            return data;
        } catch (error) { this.logger.error(`Error en findOne(${id}):`, error); throw error; }
    }

    async create(createDto: CreateVisitaPreliminarDto, userId: number) {
        try {
            const supabase = this.supabaseService.getClient();
            // Generate codigo
            const { count } = await supabase.from('visitas_preliminares').select('*', { count: 'exact', head: true });
            const codigo = `VP-${String((count || 0) + 1).padStart(4, '0')}`;

            const payload: any = {
                codigo,
                cliente_potencial_id: createDto.cliente_potencial_id,
                tipo_visitante: createDto.tipo_visitante,
                nombre_visitante: createDto.nombre_visitante,
                motivo_visita: createDto.motivo_visita || 'Inspección técnica preliminar',
                fotos_evidencia_urls: createDto.fotos_evidencia_urls || [],
                estado: createDto.estado || 'programada',
                asignado_a: createDto.asignado_a || null,
                fecha_programada: createDto.fecha_programada || null,
                hora_programada: createDto.hora_programada || null,
                notas_programacion: createDto.notas_programacion || null,
                solicitado_por_tipo: createDto.solicitado_por_tipo || 'usuario',
                solicitado_por_id: createDto.solicitado_por_id || userId,
                novedades: createDto.novedades || null,
                conclusion: createDto.conclusion || null,
                // Inspección
                tipo_perimetro: createDto.tipo_perimetro || null,
                estado_perimetro: createDto.estado_perimetro || null,
                vulnerabilidades_perimetro: createDto.vulnerabilidades_perimetro || null,
                iluminacion_exterior: createDto.iluminacion_exterior || null,
                iluminacion_interior: createDto.iluminacion_interior || null,
                puntos_acceso_peatonal: createDto.puntos_acceso_peatonal || 0,
                puntos_acceso_vehicular: createDto.puntos_acceso_vehicular || 0,
                tiene_cctv_actual: createDto.tiene_cctv_actual || false,
                estado_cctv_actual: createDto.estado_cctv_actual || null,
                cantidad_camaras_sugeridas: createDto.cantidad_camaras_sugeridas || 0,
                tipo_camaras_sugeridas: createDto.tipo_camaras_sugeridas || null,
                tiene_control_acceso_actual: createDto.tiene_control_acceso_actual || false,
                controles_acceso_sugeridos: createDto.controles_acceso_sugeridos || 0,
                tipo_control_acceso: createDto.tipo_control_acceso || null,
                tiene_alarma_actual: createDto.tiene_alarma_actual || false,
                sistema_alarma_sugerido: createDto.sistema_alarma_sugerido || false,
                red_electrica_estado: createDto.red_electrica_estado || null,
                energia_respaldo: createDto.energia_respaldo || false,
                conexion_internet: createDto.conexion_internet || null,
                proveedor_internet: createDto.proveedor_internet || null,
                nivel_riesgo_general: createDto.nivel_riesgo_general || null,
                prioridad_instalacion: createDto.prioridad_instalacion || null,
                presupuesto_estimado: createDto.presupuesto_estimado || null,
            };

            const { data, error } = await supabase.from("visitas_preliminares").insert(payload).select().single();
            if (error) { this.logger.error("Error Supabase:", error); throw new BadRequestException(`Error al registrar: ${error.message}`); }
            this.logger.log(`✅ Visita preliminar registrada: ${data.id}`);
            return data;
        } catch (error) { this.logger.error("Error en create:", error); throw error; }
    }

    async update(id: string, updateDto: any) {
        try {
            const supabase = this.supabaseService.getClient();
            const { data, error } = await supabase.from("visitas_preliminares").update({ ...updateDto, updated_at: new Date().toISOString() }).eq("id", id).select().single();
            if (error) { this.logger.error(`❌ Error actualizando ${id}:`, error); throw new BadRequestException(`No se pudo actualizar: ${error.message}`); }
            return data;
        } catch (error) { this.logger.error(`Error en update(${id}):`, error); throw error; }
    }

    async registrarSalida(id: string, updateDto: UpdateVisitaPreliminarDto) {
        try {
            const supabase = this.supabaseService.getClient();
            const updateData: any = {
                fecha_salida: new Date().toISOString(),
                estado: updateDto.estado || 'realizada',
                novedades: updateDto.novedades || null,
                conclusion: updateDto.conclusion || null,
                updated_at: new Date().toISOString(),
            };
            if (updateDto.fotos_evidencia_urls) updateData.fotos_evidencia_urls = updateDto.fotos_evidencia_urls;
            if (updateDto.firma_tecnico) updateData.firma_tecnico = updateDto.firma_tecnico;
            if (updateDto.firma_cliente) updateData.firma_cliente = updateDto.firma_cliente;
            if (updateDto.nombre_cliente_firma) updateData.nombre_cliente_firma = updateDto.nombre_cliente_firma;
            if (updateDto.cargo_cliente_firma) updateData.cargo_cliente_firma = updateDto.cargo_cliente_firma;
            if (updateDto.cedula_cliente_firma) updateData.cedula_cliente_firma = updateDto.cedula_cliente_firma;
            // Inspección fields
            const inspFields = ['tipo_perimetro','estado_perimetro','vulnerabilidades_perimetro','iluminacion_exterior','iluminacion_interior','puntos_acceso_peatonal','puntos_acceso_vehicular','tiene_cctv_actual','estado_cctv_actual','cantidad_camaras_sugeridas','tipo_camaras_sugeridas','tiene_control_acceso_actual','controles_acceso_sugeridos','tipo_control_acceso','tiene_alarma_actual','sistema_alarma_sugerido','red_electrica_estado','energia_respaldo','conexion_internet','proveedor_internet','nivel_riesgo_general','prioridad_instalacion','presupuesto_estimado'];
            inspFields.forEach(f => { if ((updateDto as any)[f] !== undefined) updateData[f] = (updateDto as any)[f]; });

            const { data, error } = await supabase.from("visitas_preliminares").update(updateData).eq("id", id).select().single();
            if (error) throw new BadRequestException("Error al registrar salida");

            if (data.estado === 'realizada') {
                await this.generarReporteAutomatico(id, updateDto.firma_tecnico, updateDto.firma_cliente, updateDto.nombre_cliente_firma, updateDto.cargo_cliente_firma, updateDto.cedula_cliente_firma);
            }
            this.logger.log(`✅ Salida visita preliminar ${id} registrada`);
            return data;
        } catch (error) { this.logger.error(`Error en registrarSalida(${id}):`, error); throw error; }
    }

    private ensureBase64Prefix(signature: string | null): string | null {
        if (!signature) return null;
        if (signature.startsWith('data:image')) return signature;
        return `data:image/png;base64,${signature}`;
    }

    async generarReporteAutomatico(id: string, firmaTecnico?: string, firmaCliente?: string, nombreClienteFirma?: string, cargoClienteFirma?: string, cedulaClienteFirma?: string) {
        try {
            const visita = await this.findOne(id);
            if (!visita) return;
            const supabase = this.supabaseService.getClient();

            const { data: plantilla } = await supabase.from('plantillas_documentos').select('id').eq('nombre', 'REPORTE DE VISITA PRELIMINAR').eq('activa', true).order('version', { ascending: false }).limit(1).single();
            if (!plantilla) { this.logger.warn("No se encontró plantilla para Visita Preliminar"); return; }

            const options: Intl.DateTimeFormatOptions = { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
            const formatter = new Intl.DateTimeFormat('es-CO', options);
            const nowParts = formatter.formatToParts(new Date());
            const getPart = (type: string) => nowParts.find(p => p.type === type)?.value;
            const fechaCol = `${getPart('day')}/${getPart('month')}/${getPart('year')}`;

            const fechaVisita = visita.fecha_programada || visita.created_at;
            const visitaParts = formatter.formatToParts(new Date(fechaVisita));
            const getVPart = (type: string) => visitaParts.find((p: any) => p.type === type)?.value;
            const fechaVisitaCol = `${getVPart('day')}/${getVPart('month')}/${getVPart('year')}`;
            const horaVisitaCol = visita.hora_programada || `${getVPart('hour')}:${getVPart('minute')}`;

            const formatTime = (dateStr: string | null) => {
                if (!dateStr) return 'Pendiente';
                const parts = formatter.formatToParts(new Date(dateStr));
                const g = (t: string) => parts.find((p: any) => p.type === t)?.value;
                return `${g('day')}/${g('month')}/${g('year')} ${g('hour')}:${g('minute')}`;
            };

            const clienteNombre = visita.clientes_potenciales?.nombre_empresa || 'PROSPECTO';

            const datos = {
                fecha_actual: fechaCol,
                tecnico_nombre: visita.asignado_a_nombre || visita.nombre_visitante || 'No asignado',
                tecnico_firma: this.ensureBase64Prefix(firmaTecnico || visita.firma_tecnico || visita.tecnico_perfil_firma),
                tecnico_cargo: visita.tecnico_cargo || 'TÉCNICO INSPECTOR',
                estado_visita: visita.estado === 'realizada' ? 'COMPLETADA' : (visita.estado || 'PROGRAMADA').toUpperCase(),
                cliente_nombre: clienteNombre,
                motivo_visita: visita.motivo_visita || 'Inspección técnica preliminar',
                solicitado_por: visita.solicitado_por_nombre || 'SISTEMA PROLISEG',
                tipo_visitante: visita.tipo_visitante || 'Supervisor',
                fecha: fechaVisitaCol,
                hora: horaVisitaCol,
                nivel_riesgo_general: visita.nivel_riesgo_general || 'No evaluado',
                fecha_ingreso: formatTime(visita.fecha_llegada),
                fecha_salida_visita: formatTime(visita.fecha_salida),
                tipo_perimetro: visita.tipo_perimetro || 'No evaluado',
                estado_perimetro: visita.estado_perimetro || 'No evaluado',
                puntos_acceso_peatonal: String(visita.puntos_acceso_peatonal || 0),
                puntos_acceso_vehicular: String(visita.puntos_acceso_vehicular || 0),
                iluminacion_exterior: visita.iluminacion_exterior || 'No evaluado',
                iluminacion_interior: visita.iluminacion_interior || 'No evaluado',
                tiene_cctv_actual: visita.tiene_cctv_actual ? 'Sí' : 'No',
                estado_cctv_actual: visita.estado_cctv_actual || 'N/A',
                cantidad_camaras_sugeridas: String(visita.cantidad_camaras_sugeridas || 0),
                tipo_camaras_sugeridas: visita.tipo_camaras_sugeridas || 'N/A',
                tiene_control_acceso_actual: visita.tiene_control_acceso_actual ? 'Sí' : 'No',
                controles_acceso_sugeridos: String(visita.controles_acceso_sugeridos || 0),
                tipo_control_acceso: visita.tipo_control_acceso || 'N/A',
                sistema_alarma_sugerido: visita.sistema_alarma_sugerido ? 'Sí' : 'No',
                red_electrica_estado: visita.red_electrica_estado || 'No evaluado',
                energia_respaldo: visita.energia_respaldo ? 'Sí' : 'No',
                conexion_internet: visita.conexion_internet || 'No evaluado',
                proveedor_internet: visita.proveedor_internet || 'N/A',
                prioridad_instalacion: visita.prioridad_instalacion || 'No definida',
                presupuesto_estimado: visita.presupuesto_estimado ? Number(visita.presupuesto_estimado).toLocaleString('es-CO') : '0',
                vulnerabilidades_perimetro: visita.vulnerabilidades_perimetro || 'Sin vulnerabilidades registradas',
                novedades: visita.novedades || 'Sin novedades registradas',
                conclusion: visita.conclusion || 'Sin conclusión registrada',
                fotos_evidencia_urls: visita.fotos_evidencia_urls || [],
                cliente_firma: this.ensureBase64Prefix(firmaCliente || visita.firma_cliente),
                nombre_cliente_firma: nombreClienteFirma || visita.nombre_cliente_firma || clienteNombre,
                cedula_cliente_firma: cedulaClienteFirma || visita.cedula_cliente_firma || '',
                cargo_cliente_firma: cargoClienteFirma || visita.cargo_cliente_firma || 'REPRESENTANTE',
            };

            const doc = await this.documentosService.create({ plantilla_id: plantilla.id, entidad_tipo: EntidadTipo.CLIENTE, entidad_id: 0, datos_json: datos });

            await supabase.from("visitas_preliminares").update({ documento_generado_id: doc.id }).eq("id", id);

            // Registrar firmas
            if (doc) {
                if (firmaTecnico || visita.firma_tecnico) {
                    await supabase.from('firmas_documentos').insert({ documento_id: doc.id, nombre_firmante: datos.tecnico_nombre, cargo_firmante: datos.tecnico_cargo, firma_base64: firmaTecnico || visita.firma_tecnico, tipo_firma: 'biometrica', orden: 1, firmado_en: new Date().toISOString() });
                }
                if (firmaCliente || visita.firma_cliente) {
                    await supabase.from('firmas_documentos').insert({ documento_id: doc.id, nombre_firmante: datos.nombre_cliente_firma, cargo_firmante: datos.cargo_cliente_firma, firma_base64: firmaCliente || visita.firma_cliente, tipo_firma: 'biometrica', orden: 2, es_ultima_firma: true, firmado_en: new Date().toISOString() });
                }
                try {
                    await this.documentosService.generarPdf(doc.id);
                    this.logger.log(`✅ PDF generado para visita preliminar ${id}`);
                } catch (pdfError) { this.logger.error(`⚠️ Error generando PDF:`, pdfError); }
            }

            this.logger.log(`📄 Reporte generado para visita preliminar ${id}: Doc ID ${doc.id}`);
            return doc;
        } catch (error) { this.logger.error("Error al generar reporte automático:", error); }
    }

    async subirEvidencia(id: string, url: string) {
        const supabase = this.supabaseService.getClient();
        const { data: visita } = await supabase.from("visitas_preliminares").select("fotos_evidencia_urls").eq("id", id).single();
        const fotosActuales = visita?.fotos_evidencia_urls || [];
        const nuevasFotos = [...fotosActuales, url];
        const { data, error } = await supabase.from("visitas_preliminares").update({ fotos_evidencia_urls: nuevasFotos, estado: 'en_curso', fecha_llegada: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id).select().single();
        if (error) { this.logger.error(`❌ Error en subirEvidencia(${id}):`, error); throw new BadRequestException(`Error: ${error.message}`); }
        return data;
    }

    async subirEvidenciaFile(id: string, file: any) {
        const publicUrl = await this.uploadEvidenciaToStorage(file, 'evidencias', id);
        return this.subirEvidencia(id, publicUrl);
    }

    async remove(id: string) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from("visitas_preliminares").delete().eq("id", id).select().single();
        if (error) { this.logger.error(`❌ Error eliminando ${id}:`, error); throw new BadRequestException(`No se pudo eliminar: ${error.message}`); }
        return data;
    }
}
