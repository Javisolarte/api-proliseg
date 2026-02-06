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
                 WHEN vt.solicitado_por_tipo = 'cliente' THEN c.nombre_completo
                 WHEN vt.solicitado_por_tipo = 'usuario' THEN u_sol.nombre
                 ELSE u.nombre 
               END as solicitado_por_nombre,
               u.nombre as registrado_por_nombre,
               ua.nombre as asignado_a_nombre
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

            if (error) throw new BadRequestException("Error al obtener visitas");
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
        SELECT vt.*, p.nombre as puesto_nombre, ua.nombre as asignado_a_nombre, 
               p.cliente_id, cl.nombre_completo as cliente_nombre
        FROM visitas_tecnicas_puesto vt
        LEFT JOIN puestos_trabajo p ON vt.puesto_id = p.id
        LEFT JOIN clientes cl ON p.cliente_id = cl.id
        LEFT JOIN usuarios_externos ua ON vt.asignado_a = ua.id
        WHERE vt.id = ${id}
      `;

            const { data, error } = await supabase.rpc("exec_sql", { query });

            if (error) throw new BadRequestException("Error al obtener visita");
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
                foto_evidencia_url: createDto.foto_evidencia_url || null,
                estado: createDto.estado || 'programada',
                asignado_a: createDto.asignado_a || null,
                fecha_programada: createDto.fecha_programada || null,
                hora_programada: createDto.hora_programada || null,
                notas_programacion: createDto.notas_programacion || null,
                solicitado_por_tipo: createDto.solicitado_por_tipo || 'usuario',
                solicitado_por_id: createDto.solicitado_por_id || userId,
            };

            if (createDto.foto_evidencia_url) {
                payload.estado = 'en_proceso';
                payload.fecha_llegada = new Date().toISOString();
            }

            const { data, error } = await supabase
                .from("visitas_tecnicas_puesto")
                .insert(payload)
                .select()
                .single();

            if (error) throw new BadRequestException("Error al registrar visita");

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
                estado: 'completada',
                cumplida: true
            };

            if (updateDto.estado) updateData.estado = updateDto.estado;
            if (updateDto.foto_evidencia_url) updateData.foto_evidencia_url = updateDto.foto_evidencia_url;

            const { data, error } = await supabase
                .from("visitas_tecnicas_puesto")
                .update(updateData)
                .eq("id", id)
                .select()
                .single();

            if (error) throw new BadRequestException("Error al registrar salida de visita");

            // Generar documento si se completó exitosamente
            if (data.estado === 'completada') {
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
                .eq('tipo', 'acta_visita')
                .eq('activa', true)
                .order('version', { ascending: false })
                .limit(1)
                .single();

            if (!plantilla) {
                this.logger.warn("No se encontró plantilla activa para Acta de Visita");
                return;
            }

            // Preparar datos para la plantilla
            const datos = {
                ciudad: 'Pasto', // Por defecto o extraer de lugar
                fecha: new Date().toLocaleDateString(),
                puesto: visita.puesto_nombre,
                supervisor: visita.nombre_visitante,
                solicitado_por: visita.solicitado_por_nombre || 'Interno',
                observaciones: visita.resultado_observaciones || 'Sin observaciones',
                nombre_supervisor: visita.nombre_visitante,
                nombre_recibe: 'Representante del Puesto' // Esto podría ser dinámico
            };

            const doc = await this.documentosService.create({
                plantilla_id: plantilla.id,
                entidad_tipo: EntidadTipo.CLIENTE, // O el que corresponda
                entidad_id: visita.cliente_id || 0,
                datos_json: datos
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
        const { data, error } = await supabase
            .from("visitas_tecnicas_puesto")
            .update({
                foto_evidencia_url: url,
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
}
