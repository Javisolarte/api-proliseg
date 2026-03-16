import { Injectable, Logger, BadRequestException, NotFoundException } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import type { CreateVisitaTecnicaDto, UpdateVisitaTecnicaDto } from "./dto/visita-tecnica.dto";

import { DocumentosGeneradosService } from "../documentos-generados/documentos-generados.service";
import { EntidadTipo } from "../documentos-generados/dto/documento-generado.dto";

@Injectable()
export class VisitasTecnicasService {
    private readonly logger = new Logger(VisitasTecnicasService.name);

    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly documentosService: DocumentosGeneradosService
    ) { }

    async findAll(filters?: { puesto_id?: number; tipo_visitante?: string; fecha_desde?: string; estado?: string }) {
        try {
            const supabase = this.supabaseService.getClient();
            let query = `
        SELECT vt.*, p.nombre as puesto_nombre, 
               CASE 
                 WHEN vt.solicitado_por_tipo = 'cliente' THEN c.nombre_empresa
                 WHEN vt.solicitado_por_tipo = 'usuario' THEN u_sol.nombre_completo
                 ELSE u.nombre_completo
               END as solicitado_por_nombre,
               u.nombre_completo as registrado_por_nombre,
               ua.nombre_completo as asignado_a_nombre
        FROM visitas_tecnicas_puesto vt
        LEFT JOIN puestos_trabajo p ON vt.puesto_id = p.id
        LEFT JOIN usuarios_externos u ON vt.registrado_por = u.id
        LEFT JOIN usuarios_externos ua ON vt.asignado_a = ua.id
        LEFT JOIN usuarios_externos u_sol ON vt.solicitado_por_id = u_sol.id AND vt.solicitado_por_tipo = 'usuario'
        LEFT JOIN clientes c ON vt.solicitado_por_id = c.id AND vt.solicitado_por_tipo = 'cliente'
        WHERE 1=1
      `;

            if (filters?.puesto_id) query += ` AND vt.puesto_id = ${filters.puesto_id}`;
            if (filters?.tipo_visitante) query += ` AND vt.tipo_visitante = '${filters.tipo_visitante}'`;
            if (filters?.fecha_desde) query += ` AND vt.fecha_llegada >= '${filters.fecha_desde}'`;
            if (filters?.estado) query += ` AND vt.estado = '${filters.estado}'`;

            query += ` ORDER BY COALESCE(vt.fecha_programada, vt.fecha_llegada) DESC`;

            const { data, error } = await supabase.rpc("exec_sql", { query });

            if (error) {
                this.logger.error("Error SQL Supabase (findAll):", error);
                throw new BadRequestException(`Error al obtener visitas: ${error.message} (${error.details})`);
            }
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
        SELECT vt.*, p.nombre as puesto_nombre, ua.nombre_completo as asignado_a_nombre, 
               p.cliente_id, cl.nombre_empresa as cliente_nombre
        FROM visitas_tecnicas_puesto vt
        LEFT JOIN puestos_trabajo p ON vt.puesto_id = p.id
        LEFT JOIN clientes cl ON p.cliente_id = cl.id
        LEFT JOIN usuarios_externos ua ON vt.asignado_a = ua.id
        WHERE vt.id = ${id}
      `;

            const { data, error } = await supabase.rpc("exec_sql", { query });

            if (error) {
                this.logger.error("Error SQL Supabase (findOne):", error);
                throw new BadRequestException(`Error al obtener visita: ${error.message} (${error.details})`);
            }
            const result = Array.isArray(data) ? data : [];
            if (result.length === 0) throw new NotFoundException(`Visita ${id} no encontrada`);

            return result[0];
        } catch (error) {
            this.logger.error(`Error en findOne(${id}):`, error);
            throw error;
        }
    }

    async create(createDto: CreateVisitaTecnicaDto, userId: number) {
        try {
            const supabase = this.supabaseService.getClient();

            const payload: any = {
                puesto_id: createDto.puesto_id,
                tipo_visitante: createDto.tipo_visitante,
                nombre_visitante: createDto.nombre_visitante,
                empresa: createDto.empresa || null,
                motivo_visita: createDto.motivo_visita || null,
                registrado_por: userId,
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
                costo_arreglo: createDto.costo_arreglo || 0
            };

            if (createDto.fotos_evidencia_urls && createDto.fotos_evidencia_urls.length > 0) {
                payload.estado = 'en_curso';
                payload.fecha_llegada = new Date().toISOString();
            }

            const { data, error } = await supabase
                .from("visitas_tecnicas_puesto")
                .insert(payload)
                .select()
                .single();

            if (error) {
                this.logger.error("Error Supabase:", error);
                throw new BadRequestException(`Error al registrar visita: ${error.message} (${error.details})`);
            }

            this.logger.log(`✅ Visita registrada: ${data.id}`);
            return data;
        } catch (error) {
            this.logger.error("Error en create:", error);
            throw error;
        }
    }

    async registrarSalida(id: number, updateDto: UpdateVisitaTecnicaDto) {
        try {
            const supabase = this.supabaseService.getClient();

            const updateData: any = {
                fecha_salida: new Date().toISOString(),
                resultado_observaciones: updateDto.resultado_observaciones || null,
                estado: 'realizada',
                cumplida: true,
                novedades: updateDto.novedades || null,
                conclusion: updateDto.conclusion || null,
                costo_arreglo: updateDto.costo_arreglo || 0
            };

            if (updateDto.estado) updateData.estado = updateDto.estado;
            if (updateDto.fotos_evidencia_urls) updateData.fotos_evidencia_urls = updateDto.fotos_evidencia_urls;

            const { data, error } = await supabase
                .from("visitas_tecnicas_puesto")
                .update(updateData)
                .eq("id", id)
                .select()
                .single();

            if (error) throw new BadRequestException("Error al registrar salida de visita");

            // Generar documento si se completó exitosamente
            if (data.estado === 'realizada') {
                await this.generarReporteAutomatico(id);
            }

            this.logger.log(`✅ Salida de visita ${id} registrada`);
            return data;
        } catch (error) {
            this.logger.error(`Error en registrarSalida(${id}):`, error);
            throw error;
        }
    }

    async generarReporteAutomatico(id: number) {
        try {
            const visita = await this.findOne(id);
            const supabase = this.supabaseService.getClient();

            // Buscar la plantilla de Acta de Visita
            const { data: plantilla } = await supabase
                .from('plantillas_documentos')
                .select('id')
                .eq('nombre', 'ACTA DE VISITA TÉCNICA')
                .eq('activa', true)
                .order('version', { ascending: false })
                .limit(1)
                .single();

            if (!plantilla) {
                this.logger.warn("No se encontró plantilla activa para Acta de Visita");
                return;
            }

            // Obtener información del técnico (asignado_a)
            const { data: tecnicoInfo } = await supabase
                .from('empleados')
                .select('nombre_completo, firma_digital_base64, cargo_oficial')
                .eq('usuario_id', visita.asignado_a)
                .single();

            // Obtener información de quien programó (registrado_por)
            const { data: programadorInfo } = await supabase
                .from('empleados')
                .select('nombre_completo, firma_digital_base64, cargo_oficial')
                .eq('usuario_id', visita.registrado_por)
                .single();

            // Preparar datos para la plantilla
            const datos = {
                fecha_actual: new Date().toLocaleDateString(),
                hora_actual: new Date().toLocaleTimeString(),
                fecha: new Date(visita.fecha_programada || visita.created_at).toLocaleDateString(),
                hora: new Date(visita.fecha_programada || visita.created_at).toLocaleTimeString(),
                codigo: visita.codigo || `VIS-${visita.id}`,
                cliente_nombre: visita.cliente_nombre || 'CLIENTE PROLISEG',
                puesto_nombre: visita.puesto_nombre || 'PUESTO NO ESPECIFICADO',
                tecnico_nombre: tecnicoInfo?.nombre_completo || visita.nombre_visitante || 'No asignado',
                tecnico_firma: tecnicoInfo?.firma_digital_base64 || null,
                tecnico_cargo: tecnicoInfo?.cargo_oficial || 'TÉCNICO OPERATIVO',
                programador_nombre: programadorInfo?.nombre_completo || 'SISTEMA PROLISEG',
                programador_firma: programadorInfo?.firma_digital_base64 || null,
                programador_cargo: programadorInfo?.cargo_oficial || 'COORDINADOR OPERATIVO',
                motivo: visita.motivo_visita || 'Mantenimiento / Revisión',
                novedades: visita.novedades || 'Sin novedades registradas',
                conclusion: visita.conclusion || 'Sin conclusión registrada',
                fotos_evidencia_urls: visita.fotos_evidencia_urls || []
            };

            const doc = await this.documentosService.create({
                plantilla_id: plantilla.id,
                entidad_tipo: EntidadTipo.CLIENTE,
                entidad_id: visita.cliente_id || 0,
                datos_json: datos
            });

            // Registrar en la Minuta Electrónica del Puesto
            await supabase.from('minutas').insert({
                puesto_id: visita.puesto_id,
                contenido: `VISITA TÉCNICA COMPLETADA (${datos.codigo}): ${datos.conclusion}`,
                tipo: 'SOPORTE_TECNICO', // Asumiendo este tipo o uno similar
                fecha: new Date().toISOString().split('T')[0],
                hora: new Date().toLocaleTimeString('en-GB', { hour12: false }),
                creada_por: visita.asignado_a,
                fotos: visita.fotos_evidencia_urls || []
            });

            // Vincular el documento a la visita
            await supabase
                .from("visitas_tecnicas_puesto")
                .update({ documento_generado_id: doc.id })
                .eq("id", id);

            this.logger.log(`📄 Reporte generado para visita ${id}: Doc ID ${doc.id}`);
            return doc;
        } catch (error) {
            this.logger.error("Error al generar reporte automático:", error);
        }
    }

    async subirEvidencia(id: number, url: string) {
        const supabase = this.supabaseService.getClient();
        
        // Primero obtener las fotos actuales
        const { data: visita } = await supabase
            .from("visitas_tecnicas_puesto")
            .select("fotos_evidencia_urls")
            .eq("id", id)
            .single();

        const fotosActuales = visita?.fotos_evidencia_urls || [];
        const nuevasFotos = [...fotosActuales, url];

        const { data, error } = await supabase
            .from("visitas_tecnicas_puesto")
            .update({
                fotos_evidencia_urls: nuevasFotos,
                estado: 'en_proceso',
                fecha_llegada: new Date().toISOString()
            })
            .eq("id", id)
            .select()
            .single();

        if (error) throw new BadRequestException("Error subiendo evidencia");
        return data;
    }

    async getReportes(filtros: any) {
        const supabase = this.supabaseService.getClient();

        const { data: stats, error } = await supabase
            .from("visitas_tecnicas_puesto")
            .select("estado, cumplida");

        if (error) return { total: 0 };

        return {
            total: stats.length,
            completadas: stats.filter(s => s.estado === 'completada').length,
            programadas: stats.filter(s => s.estado === 'programada').length,
            en_proceso: stats.filter(s => s.estado === 'en_proceso').length,
            incumplidas: stats.filter(s => s.estado === 'incumplida').length,
            cumplimiento_porcentaje: stats.length > 0
                ? (stats.filter(s => s.cumplida).length / stats.length) * 100
                : 0
        };
    }

    async validarVisita(id: number, userId: number) {
        try {
            const supabase = this.supabaseService.getClient();
            const { data, error } = await supabase
                .from("visitas_tecnicas_puesto")
                .update({
                    validado: true,
                    validado_por: userId
                })
                .eq("id", id)
                .select()
                .single();

            if (error) throw new BadRequestException("Error al validar visita");

            this.logger.log(`✅ Visita ${id} validada por usuario ${userId}`);
            return data;
        } catch (error) {
            this.logger.error(`Error en validarVisita(${id}):`, error);
            throw error;
        }
    }
}
