import { Injectable, Logger, BadRequestException, NotFoundException } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import type { CreateVisitaTecnicaDto, UpdateVisitaTecnicaDto } from "./dto/visita-tecnica.dto";
import type { IniciarVisitaDto, ActualizarVisitaAppDto, FinalizarVisitaAppDto } from "../autoservicio/dto/visitas-tecnicas-autoservicio.dto";

import { DocumentosGeneradosService } from "../documentos-generados/documentos-generados.service";
import { EntidadTipo } from "../documentos-generados/dto/documento-generado.dto";
import { NotificacionesService } from "../notificaciones/notificaciones.service";

@Injectable()
export class VisitasTecnicasService {
    private readonly logger = new Logger(VisitasTecnicasService.name);

    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly documentosService: DocumentosGeneradosService,
        private readonly notificacionesService: NotificacionesService
    ) { }

    // 🔹 Helper para subir archivos a Supabase Storage
    async uploadEvidenciaToStorage(file: any, folder: string, filenameId: number): Promise<string> {
        const bucket = 'visitas';
        const supabase = this.supabaseService.getSupabaseAdminClient();
        
        const ext = file.originalname.split('.').pop() || 'jpg';
        const path = `${folder}/${filenameId}_${Date.now()}.${ext}`;

        const { error } = await supabase.storage
            .from(bucket)
            .upload(path, file.buffer, {
                contentType: file.mimetype,
                upsert: true,
            });

        if (error) {
            this.logger.error(`❌ Error subiendo evidencia a ${bucket}/${path}: ${JSON.stringify(error)}`);
            throw error;
        }

        const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(path);
        return publicUrlData.publicUrl;
    }

    async findAll(filters?: { puesto_id?: number; tipo_visitante?: string; fecha_desde?: string; estado?: string }) {
        try {
            const supabase = this.supabaseService.getClient();
            let query = `
        SELECT vt.*, p.nombre as puesto_nombre, 
               CASE 
                 WHEN vt.solicitado_por_tipo = 'cliente' THEN c_sol.nombre_empresa
                 WHEN vt.solicitado_por_tipo = 'usuario' THEN u_sol.nombre_completo
                 ELSE COALESCE(u_reg.nombre_completo, 'SISTEMA PROLISEG')
               END as solicitado_por_nombre,
               u_reg.nombre_completo as registrado_por_nombre,
               ua.nombre_completo as asignado_a_nombre,
               con.cliente_id as cliente_id,
               emp.cargo_oficial as tecnico_cargo,
               emp.firma_digital_base64 as tecnico_perfil_firma,
               emp_sol.firma_digital_base64 as solicitado_por_firma,
               emp_sol.cargo_oficial as programador_cargo
        FROM visitas_tecnicas_puesto vt
        LEFT JOIN puestos_trabajo p ON vt.puesto_id = p.id
        LEFT JOIN contratos con ON p.contrato_id = con.id
        LEFT JOIN usuarios_externos u_reg ON vt.registrado_por = u_reg.id
        LEFT JOIN usuarios_externos ua ON vt.asignado_a = ua.id
        LEFT JOIN empleados emp ON ua.id = emp.usuario_id
        LEFT JOIN usuarios_externos u_sol ON vt.solicitado_por_id = u_sol.id AND vt.solicitado_por_tipo = 'usuario'
        LEFT JOIN clientes c_sol ON vt.solicitado_por_id = c_sol.id AND vt.solicitado_por_tipo = 'cliente'
        LEFT JOIN empleados emp_sol ON (
          (vt.solicitado_por_tipo = 'usuario' AND vt.solicitado_por_id = emp_sol.usuario_id) OR
          (vt.solicitado_por_tipo IS NULL AND vt.registrado_por = emp_sol.usuario_id)
        )
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
               con.cliente_id, cl.nombre_empresa as cliente_nombre,
               vt.firma_tecnico, vt.firma_recibe, vt.nombre_recibe,
               CASE 
                 WHEN vt.solicitado_por_tipo = 'cliente' THEN c_sol.nombre_empresa
                 WHEN vt.solicitado_por_tipo = 'usuario' THEN u_sol.nombre_completo
                 ELSE COALESCE(u_reg.nombre_completo, 'SISTEMA PROLISEG')
               END as solicitado_por_nombre,
               emp.cargo_oficial as tecnico_cargo,
               emp.firma_digital_base64 as tecnico_perfil_firma,
               emp_sol.firma_digital_base64 as solicitado_por_firma,
               emp_sol.cargo_oficial as programador_cargo,
               (SELECT firma_base64 FROM firmas_documentos WHERE documento_id = vt.documento_generado_id AND orden = 1 LIMIT 1) as firma_tecnico_doc,
               (SELECT firma_base64 FROM firmas_documentos WHERE documento_id = vt.documento_generado_id AND orden = 2 LIMIT 1) as firma_recibe_doc
        FROM visitas_tecnicas_puesto vt
        LEFT JOIN puestos_trabajo p ON vt.puesto_id = p.id
        LEFT JOIN contratos con ON p.contrato_id = con.id
        LEFT JOIN clientes cl ON con.cliente_id = cl.id
        LEFT JOIN usuarios_externos ua ON vt.asignado_a = ua.id
        LEFT JOIN empleados emp ON ua.id = emp.usuario_id
        LEFT JOIN usuarios_externos u_reg ON vt.registrado_por = u_reg.id
        LEFT JOIN usuarios_externos u_sol ON vt.solicitado_por_id = u_sol.id AND vt.solicitado_por_tipo = 'usuario'
        LEFT JOIN clientes c_sol ON vt.solicitado_por_id = c_sol.id AND vt.solicitado_por_tipo = 'cliente'
        LEFT JOIN empleados emp_sol ON (
          (vt.solicitado_por_tipo = 'usuario' AND vt.solicitado_por_id = emp_sol.usuario_id) OR
          (vt.solicitado_por_tipo IS NULL AND vt.registrado_por = emp_sol.usuario_id)
        )
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

            // NOTIFICACIÓN AL TÉCNICO
            if (data.asignado_a) {
                const canales = createDto.notificar_por || ['email', 'whatsapp', 'sms', 'push'];
                this.notificacionesService.dispararEvento("NUEVA_VISITA_TECNICA", {
                    destinatarios: [{ id: data.asignado_a, tipo: 'usuario' }],
                    variables: {
                        puesto: data.puesto_nombre || 'Puesto asignado',
                        fecha: data.fecha_programada || 'Pendiente',
                        hora: data.hora_programada || 'Pendiente'
                    },
                    canales
                }).catch(err => this.logger.error("Error enviando notificación de visita:", err));
            }

            return data;
        } catch (error) {
            this.logger.error("Error en create:", error);
            throw error;
        }
    }

    async notificarVisita(id: number, canales?: string[]) {
        try {
            const visita = await this.findOne(id);
            if (!visita) throw new NotFoundException('Visita no encontrada');
            if (!visita.asignado_a) throw new BadRequestException('La visita no tiene un técnico asignado');

            await this.notificacionesService.dispararEvento("NUEVA_VISITA_TECNICA", {
                destinatarios: [{ id: visita.asignado_a, tipo: 'usuario' }],
                variables: {
                    puesto: visita.puesto_nombre || 'Puesto asignado',
                    fecha: visita.fecha_programada || 'Pendiente',
                    hora: visita.hora_programada || 'Pendiente'
                },
                canales: canales || ['email', 'whatsapp', 'sms', 'push']
            });

            return { success: true, message: 'Notificaciones disparadas' };
        } catch (error) {
            this.logger.error(`Error notificando visita ${id}:`, error);
            throw error;
        }
    }


    async update(id: number, updateDto: UpdateVisitaTecnicaDto) {
        try {
            const supabase = this.supabaseService.getClient();
            const { data, error } = await supabase
                .from("visitas_tecnicas_puesto")
                .update(updateDto)
                .eq("id", id)
                .select()
                .single();

            if (error) {
                this.logger.error(`❌ Error actualizando visita ${id}:`, error);
                throw new BadRequestException(`No se pudo actualizar la visita: ${error.message}`);
            }
            return data;
        } catch (error) {
            this.logger.error(`Error en update(${id}):`, error);
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
            if (updateDto.firma_tecnico) updateData.firma_tecnico = updateDto.firma_tecnico;

            const { data, error } = await supabase
                .from("visitas_tecnicas_puesto")
                .update(updateData)
                .eq("id", id)
                .select()
                .single();

            if (error) throw new BadRequestException("Error al registrar salida de visita");

            // Generar documento si se completó exitosamente
            if (data.estado === 'realizada') {
                await this.generarReporteAutomatico(id, 
                    updateDto.firma_tecnico 
                        ? { tecnico: updateDto.firma_tecnico, recibe: '', nombre_recibe: '' } 
                        : undefined
                );
            }

            this.logger.log(`✅ Salida de visita ${id} registrada`);
            return data;
        } catch (error) {
            this.logger.error(`Error en registrarSalida(${id}):`, error);
            throw error;
        }
    }

    private ensureBase64Prefix(signature: string | null): string | null {
        if (!signature) return null;
        if (signature.startsWith('data:image')) return signature;
        return `data:image/png;base64,${signature}`;
    }

    async generarReporteAutomatico(id: number, firmasApp?: { tecnico: string, recibe: string, nombre_recibe: string }) {
        try {
            // we use findOne because it has the enriched joins for names, etc.
            const visita = await this.findOne(id);
            if (!visita) return;

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

            // Configurar hora colombiana (UTC-5)
            const options: Intl.DateTimeFormatOptions = { 
                timeZone: 'America/Bogota',
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
                hour12: false
            };
            const formatter = new Intl.DateTimeFormat('es-CO', options);
            const nowParts = formatter.formatToParts(new Date());
            const getPart = (type: string) => nowParts.find(p => p.type === type)?.value;
            
            const fechaCol = `${getPart('day')}/${getPart('month')}/${getPart('year')}`;
            const horaCol = `${getPart('hour')}:${getPart('minute')}:${getPart('second')}`;

            const fechaVisita = visita.fecha_programada || visita.created_at;
            const visitaParts = formatter.formatToParts(new Date(fechaVisita));
            const getVPart = (type: string) => visitaParts.find((p: any) => p.type === type)?.value;
            const fechaVisitaCol = `${getVPart('day')}/${getVPart('month')}/${getVPart('year')}`;
            const horaVisitaCol = visita.hora_programada || `${getVPart('hour')}:${getVPart('minute')}`;

            // Preparar datos para la plantilla
            // Calcular duración de la visita
            let duracionStr = 'No disponible';
            if (visita.fecha_llegada && visita.fecha_salida) {
                const llegada = new Date(visita.fecha_llegada);
                const salida = new Date(visita.fecha_salida);
                const diffMs = salida.getTime() - llegada.getTime();
                const diffMins = Math.round(diffMs / 60000);
                if (diffMins < 60) {
                    duracionStr = `${diffMins} minutos`;
                } else {
                    const hrs = Math.floor(diffMins / 60);
                    const mins = diffMins % 60;
                    duracionStr = `${hrs}h ${mins}m`;
                }
            }

            // Formatear hora de llegada y salida
            const formatTime = (dateStr: string | null) => {
                if (!dateStr) return 'Pendiente';
                const parts = formatter.formatToParts(new Date(dateStr));
                const g = (t: string) => parts.find((p: any) => p.type === t)?.value;
                return `${g('day')}/${g('month')}/${g('year')} ${g('hour')}:${g('minute')}`;
            };

            // Mapeo de roles legibles
            const rolesMap: any = {
                'tecnico': 'Técnico',
                'supervisor': 'Supervisor', 
                'coordinador': 'Coordinador',
                'ingeniero': 'Ingeniero',
                'mensajero': 'Mensajero'
            };

            const datos = {
                fecha_actual: fechaCol,
                hora_actual: horaCol,
                fecha: fechaVisitaCol,
                hora: horaVisitaCol,
                codigo: visita.codigo || `VIS-${visita.id}`,
                cliente_nombre: visita.cliente_nombre || 'CLIENTE PROLISEG',
                puesto_nombre: visita.puesto_nombre || 'PUESTO NO ESPECIFICADO',
                tecnico_nombre: visita.asignado_a_nombre || visita.nombre_visitante || 'No asignado',
                tecnico_firma: this.ensureBase64Prefix(firmasApp?.tecnico || visita.firma_tecnico || visita.tecnico_perfil_firma),
                tecnico_cargo: visita.tecnico_cargo || 'TÉCNICO OPERATIVO',
                tipo_visitante: rolesMap[visita.tipo_visitante] || visita.tipo_visitante || 'Técnico',
                estado_visita: visita.estado === 'realizada' ? 'COMPLETADA' : (visita.estado || 'PROGRAMADA').toUpperCase(),
                fecha_ingreso: formatTime(visita.fecha_llegada),
                fecha_salida_visita: formatTime(visita.fecha_salida),
                duracion: duracionStr,
                solicitado_por: visita.solicitado_por_nombre || 'SISTEMA PROLISEG',
                programador_nombre: visita.solicitado_por_nombre || 'SISTEMA PROLISEG',
                programador_firma: this.ensureBase64Prefix(visita.solicitado_por_firma),
                programador_cargo: visita.programador_cargo || 'COORDINADOR OPERATIVO',
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
                tipo: 'SOPORTE_TECNICO',
                fecha: new Date().toISOString().split('T')[0],
                hora: horaCol.substring(0, 5),
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
                estado: 'en_curso',
                fecha_llegada: new Date().toISOString()
            })
            .eq("id", id)
            .select()
            .single();

        if (error) {
            this.logger.error(`❌ Error en subirEvidencia(${id}):`, error);
            throw new BadRequestException(`Error subiendo evidencia: ${error.message}`);
        }
        return data;
    }

    async subirEvidenciaFile(id: number, file: any) {
        // Subir foto a storage
        const publicUrl = await this.uploadEvidenciaToStorage(file, 'evidencias', id);
        
        // Llamar directo al base (este valida internamente)
        return this.subirEvidencia(id, publicUrl);
    }

    async getReportes(filtros: any) {
        const supabase = this.supabaseService.getClient();

        const { data: stats, error } = await supabase
            .from("visitas_tecnicas_puesto")
            .select("estado, cumplida");

        if (error) return { total: 0 };

        return {
            total: stats.length,
            completadas: stats.filter(s => s.estado === 'realizada').length,
            programadas: stats.filter(s => s.estado === 'programada').length,
            en_proceso: stats.filter(s => s.estado === 'en_curso').length,
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

    // --- MÉTODOS PARA AUTOSERVICIO TÉCNICO (APP) ---

    async findMisVisitas(usuarioId: number) {
        const supabase = this.supabaseService.getClient();
        const query = `
            SELECT vt.*, p.nombre as puesto_nombre
            FROM visitas_tecnicas_puesto vt
            LEFT JOIN puestos_trabajo p ON vt.puesto_id = p.id
            WHERE vt.asignado_a = ${usuarioId}
            AND vt.estado IN ('programada', 'en_curso', 'realizada')
            ORDER BY 
                CASE WHEN vt.estado = 'en_curso' THEN 1
                     WHEN vt.estado = 'programada' THEN 2
                     ELSE 3 END,
                vt.fecha_programada DESC,
                vt.created_at DESC
        `;
        const { data, error } = await supabase.rpc("exec_sql", { query });
        if (error) throw new BadRequestException("Error obteniendo visitas asignadas");
        return data || [];
    }

    async iniciarVisita(id: number, usuarioId: number, dto: IniciarVisitaDto) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from("visitas_tecnicas_puesto")
            .update({
                estado: 'en_curso',
                fecha_llegada: new Date().toISOString(),
                fotos_evidencia_urls: [dto.foto_llegada_url],
                novedades: dto.notas_llegada || null
            })
            .eq("id", id)
            .eq("asignado_a", usuarioId)
            .select()
            .single();

        if (error) {
            this.logger.error(`❌ Error en iniciarVisita(${id}):`, error);
            throw new BadRequestException(`No se pudo iniciar la visita: ${error.message}`);
        }

        // Notificar inicio de visita
        try {
            await this.notificarVisita(id, ['push', 'email']); // Notificar por canales internos
        } catch (notifError) {
            this.logger.warn(`No se pudo enviar notificación de inicio para visita ${id}:`, notifError);
        }

        return data;
    }

    async iniciarVisitaWithFile(id: number, usuarioId: number, file: any, dto: IniciarVisitaDto) {
        // Subir foto a storage
        const publicUrl = await this.uploadEvidenciaToStorage(file, 'llegadas', id);
        dto.foto_llegada_url = publicUrl;
        
        // Llamar al método base
        return this.iniciarVisita(id, usuarioId, dto);
    }

    async actualizarVisitaApp(id: number, usuarioId: number, dto: ActualizarVisitaAppDto) {
        const supabase = this.supabaseService.getClient();
        
        // Obtener actuales para anexar fotos
        const { data: actual } = await supabase
            .from("visitas_tecnicas_puesto")
            .select("fotos_evidencia_urls")
            .eq("id", id)
            .single();

        const nuevasFotos = [...(actual?.fotos_evidencia_urls || [])];
        if (dto.fotos_adicionales) nuevasFotos.push(...dto.fotos_adicionales);

        const updateObj: any = {
            fotos_evidencia_urls: nuevasFotos
        };
        if (dto.novedades) updateObj.novedades = dto.novedades;
        if (dto.conclusion) updateObj.conclusion = dto.conclusion;
        if (dto.costo_arreglo !== undefined) updateObj.costo_arreglo = dto.costo_arreglo;

        const { data, error } = await supabase
            .from("visitas_tecnicas_puesto")
            .update(updateObj)
            .eq("id", id)
            .eq("asignado_a", usuarioId)
            .select()
            .single();

        if (error) {
            this.logger.error(`❌ Error en actualizarVisitaApp(${id}):`, error);
            throw new BadRequestException(`Error actualizando visita desde el app: ${error.message}`);
        }

        // Notificar actualización (opcional)
        if (dto.novedades || (dto.fotos_adicionales && dto.fotos_adicionales.length > 0)) {
            try {
                await this.notificarVisita(id, ['push']);
            } catch (e) {
                // Silencioso
            }
        }

        return data;
    }

    async finalizarVisitaApp(id: number, usuarioId: number, dto: FinalizarVisitaAppDto) {
        const supabase = this.supabaseService.getClient();
        
        // 1. Actualizar datos de la visita (incluye firma del técnico Base64)
        const { data, error } = await supabase
            .from("visitas_tecnicas_puesto")
            .update({
                estado: 'realizada',
                fecha_salida: new Date().toISOString(),
                conclusion: dto.conclusion,
                novedades: dto.novedades || null,
                costo_arreglo: dto.costo_arreglo || 0,
                cumplida: true,
                firma_tecnico: dto.firma_tecnico_base64 || null,
                firma_recibe: dto.firma_recibe_base64 || null,
                nombre_recibe: dto.nombre_recibe || null
            })
            .eq("id", id)
            .eq("asignado_a", usuarioId)
            .select()
            .single();

        if (error) {
            this.logger.error(`❌ Error en finalizarVisitaApp(${id}):`, error);
            throw new BadRequestException(`Error al finalizar visita: ${error.message}`);
        }

        // 2. Generar Reporte Automático (crea el documento en borrador + minuta)
        const doc = await this.generarReporteAutomatico(id, {
            tecnico: dto.firma_tecnico_base64,
            recibe: dto.firma_recibe_base64 || '',
            nombre_recibe: dto.nombre_recibe || ''
        });

        // 3. Registrar firma del técnico en firmas_documentos
        if (doc) {
            await supabase.from('firmas_documentos').insert({
                documento_id: doc.id,
                nombre_firmante: 'Técnico Asignado',
                cargo_firmante: 'TÉCNICO',
                firma_base64: dto.firma_tecnico_base64,
                tipo_firma: 'biometrica',
                orden: 1,
                firmado_en: new Date().toISOString()
            });

            // Firma de quien recibe (solo si se proporcionó)
            if (dto.firma_recibe_base64) {
                await supabase.from('firmas_documentos').insert({
                    documento_id: doc.id,
                    nombre_firmante: dto.nombre_recibe || 'Cliente / Receptor',
                    cargo_firmante: 'CLIENTE / RECEPTOR',
                    firma_base64: dto.firma_recibe_base64,
                    tipo_firma: 'biometrica',
                    orden: 2,
                    es_ultima_firma: true,
                    firmado_en: new Date().toISOString()
                });
            }

            // 4. Generar el PDF automáticamente
            try {
                const pdfResult = await this.documentosService.generarPdf(doc.id);
                this.logger.log(`✅ PDF generado para visita ${id}: ${pdfResult?.url_pdf}`);
                
                // Devolver los datos con la URL del PDF para descarga
                return {
                    ...data,
                    documento_generado_id: doc.id,
                    url_pdf: pdfResult?.url_pdf || null,
                    mensaje: 'Visita finalizada exitosamente. Documento PDF generado.'
                };
            } catch (pdfError) {
                this.logger.error(`⚠️ Error generando PDF para visita ${id}:`, pdfError);
                // Continuamos aún si falla el PDF — la visita ya está finalizada
                return {
                    ...data,
                    documento_generado_id: doc.id,
                    url_pdf: null,
                    mensaje: 'Visita finalizada. PDF pendiente de generación.'
                };
            }
        }

        // Notificar finalización
        try {
            await this.notificarVisita(id, ['push', 'email']);
        } catch (notifError) {
            this.logger.warn(`No se pudo enviar notificación de cierre para visita ${id}:`, notifError);
        }

        return { ...data, mensaje: 'Visita finalizada exitosamente.' };
    }

    async remove(id: number) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from("visitas_tecnicas_puesto")
            .delete()
            .eq("id", id)
            .select()
            .single();

        if (error) {
            this.logger.error(`❌ Error eliminando visita ${id}:`, error);
            throw new BadRequestException(`No se pudo eliminar la visita: ${error.message}`);
        }
        return data;
    }
}

