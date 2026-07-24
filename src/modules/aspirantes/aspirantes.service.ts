import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreatePruebaDto } from './dto/create-prueba.dto';
import { CreatePreguntaDto } from './dto/create-pregunta.dto';
import { CreateAspiranteDto } from './dto/create-aspirante.dto';
import { ProgramarIntentoDto, ReprogramarIntentoDto } from './dto/programar-intento.dto';
import { SubmitRespuestaDto } from './dto/submit-respuesta.dto';
import { SaveDatosPreEmpleadoDto } from './dto/save-datos-pre-empleado.dto';
import { EvaluatePsicotecnicaDto, DictamenPsicologico } from './dto/evaluate-psicotecnica.dto';
import * as puppeteer from 'puppeteer';
import { Response } from 'express';

@Injectable()
export class AspirantesService {
    private readonly logger = new Logger(AspirantesService.name);

    constructor(private readonly supabase: SupabaseService) { }

    // ==========================================
    // 1. GESTIÓN DE PRUEBAS (ADMIN)
    // ==========================================

    async createPrueba(dto: CreatePruebaDto) {
        const db = this.supabase.getClient();
        const { data, error } = await db.from('aspirantes_pruebas').insert(dto).select().single();
        if (error) throw new InternalServerErrorException(error.message);
        return data;
    }

    async findAllPruebas() {
        const db = this.supabase.getClient();
        const { data, error } = await db.from('aspirantes_pruebas').select('*').order('created_at', { ascending: false });
        if (error) throw new InternalServerErrorException(error.message);
        return data;
    }

    async deletePrueba(id: number) {
        const db = this.supabase.getClient();
        const { error } = await db.from('aspirantes_pruebas').delete().eq('id', id);
        if (error) throw new InternalServerErrorException(error.message);
        return { message: 'Prueba eliminada correctamente' };
    }

    // ==========================================
    // 2. GESTIÓN DE PREGUNTAS (ADMIN)
    // ==========================================

    async createPregunta(dto: CreatePreguntaDto) {
        const db = this.supabase.getClient();

        // 1. Crear pregunta
        const { data: pregunta, error: errorPregunta } = await db
            .from('aspirantes_preguntas')
            .insert({
                prueba_id: dto.prueba_id,
                pregunta: dto.pregunta,
                retroalimentacion: dto.retroalimentacion,
                orden: dto.orden
            })
            .select()
            .single();

        if (errorPregunta) throw new InternalServerErrorException(errorPregunta.message);

        // 2. Crear opciones
        const opcionesToInsert = dto.opciones.map(op => ({
            pregunta_id: pregunta.id,
            texto: op.texto,
            es_correcta: op.es_correcta,
            orden: op.orden
        }));

        const { error: errorOpciones } = await db.from('aspirantes_preguntas_opciones').insert(opcionesToInsert);
        if (errorOpciones) throw new InternalServerErrorException(errorOpciones.message);

        return { ...pregunta, opciones: opcionesToInsert };
    }

    async deletePregunta(id: number) {
        const db = this.supabase.getClient();
        const { error } = await db.from('aspirantes_preguntas').delete().eq('id', id);
        if (error) throw new InternalServerErrorException(error.message);
        return { message: 'Pregunta eliminada correctamente' };
    }

    // ==========================================
    // 3. GESTIÓN DE ASPIRANTES (ADMIN)
    // ==========================================

    async registerAspirante(dto: CreateAspiranteDto) {
        const db = this.supabase.getClient();

        // Verificar si existe por cédula
        const { data: existing } = await db.from('aspirantes').select('*').eq('cedula', dto.cedula).single();

        if (existing) {
            return { message: 'Aspirante ya existe, se retornan sus datos', data: existing };
        }

        const { data, error } = await db.from('aspirantes').insert(dto).select().single();
        if (error) throw new InternalServerErrorException(error.message);
        return { message: 'Aspirante registrado correctamente', data };
    }

    async findAllAspirantes() {
        const db = this.supabase.getClient();
        const { data: aspirantes, error } = await db.from('aspirantes')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw new InternalServerErrorException(error.message);

        const { data: todosIntentos } = await db.from('aspirantes_intentos_prueba')
            .select('*, aspirantes_pruebas(*)');

        const result = (aspirantes || []).map((asp: any) => {
            const aspIntentos = (todosIntentos || []).filter((i: any) => String(i.aspirante_id) === String(asp.id));
            let pruebaTecnica: any = null;
            let pruebaPsicotecnica: any = null;

            for (const item of aspIntentos) {
                const esPresentado = item.presentado === true || item.presentado === 1 || item.presentado === 'true' || !!item.fecha_fin_real || item.porcentaje != null;
                if (!esPresentado) continue;

                const pruebaObj = Array.isArray(item.aspirantes_pruebas) ? item.aspirantes_pruebas[0] : item.aspirantes_pruebas;
                const tipo = pruebaObj?.tipo;
                const nombre = (pruebaObj?.nombre || '').toUpperCase();

                if (tipo === 'psicotecnica' || nombre.includes('BUSS') || nombre.includes('PSICO')) {
                    pruebaPsicotecnica = {
                        id: item.id,
                        dictamen: item.dictamen_psicologico || 'PENDIENTE',
                        aprobado: item.aprobado,
                        pdf_url: item.pdf_prueba_url
                    };
                } else {
                    pruebaTecnica = {
                        id: item.id,
                        porcentaje: item.porcentaje != null ? Math.round(item.porcentaje) : Math.round(item.puntaje_obtenido || 0),
                        aprobado: item.aprobado,
                        pdf_url: item.pdf_prueba_url
                    };
                }
            }

            let estadoGlobal = asp.estado;
            if (pruebaTecnica && pruebaPsicotecnica) {
                if (pruebaTecnica.aprobado && pruebaPsicotecnica.dictamen === 'APTO') {
                    if (asp.estado !== 'contratado') estadoGlobal = 'aprobado';
                } else if (!pruebaTecnica.aprobado || pruebaPsicotecnica.dictamen === 'NO APTO') {
                    if (asp.estado !== 'contratado') estadoGlobal = 'no_apto';
                }
            } else if (pruebaTecnica && pruebaTecnica.aprobado) {
                if (asp.estado !== 'contratado') estadoGlobal = 'aprobado';
            }

            return {
                ...asp,
                estado: estadoGlobal,
                prueba_tecnica: pruebaTecnica,
                prueba_psicotecnica: pruebaPsicotecnica
            };
        });

        return result;
    }

    async generarPdfIntento(id: number) {
        const db = this.supabase.getClient();
        const { buffer } = await this.generateTestReportPdfBuffer(id);
        const adminSupabase = this.supabase.getSupabaseAdminClient();

        const { data: intento } = await db.from('aspirantes_intentos_prueba').select('aspirante_id').eq('id', id).single();
        const aspiranteId = intento?.aspirante_id || '0';
        const fileName = `prueba-${aspiranteId}-${id}.pdf`;

        await adminSupabase.storage.from('pruebas').upload(fileName, buffer, { contentType: 'application/pdf', upsert: true });
        const { data: urlData } = adminSupabase.storage.from('pruebas').getPublicUrl(fileName);

        const publicUrl = urlData?.publicUrl || '';
        if (publicUrl) {
            await db.from('aspirantes_intentos_prueba').update({ pdf_prueba_url: publicUrl }).eq('id', id);
        }

        return { pdf_prueba_url: publicUrl };
    }

    async listarPendientesCalificar() {
        const db = this.supabase.getClient();
        const { data, error } = await db.from('aspirantes_intentos_prueba')
            .select('*, aspirantes(*), aspirantes_pruebas(*)')
            .eq('presentado', true)
            .order('fecha_fin_real', { ascending: false });

        if (error) throw new InternalServerErrorException(error.message);

        const pendientes = (data || []).filter((item: any) => {
            const tipo = item.aspirantes_pruebas?.tipo;
            const nombre = (item.aspirantes_pruebas?.nombre || '').toUpperCase();
            return tipo === 'psicotecnica' || nombre.includes('BUSS') || nombre.includes('PSICO');
        });

        return pendientes;
    }

    async findOneAspirante(id: number) {
        const db = this.supabase.getClient();
        const { data, error } = await db.from('aspirantes').select('*, aspirantes_intentos_prueba(*)').eq('id', id).single();
        if (error) throw new NotFoundException('Aspirante no encontrado');
        return data;
    }

    async deleteAspirante(id: number) {
        const db = this.supabase.getClient();
        const { error } = await db.from('aspirantes').delete().eq('id', id);
        if (error) throw new InternalServerErrorException(error.message);
        return { message: 'Aspirante eliminado' };
    }

    async updateAspirante(id: number, dto: Partial<CreateAspiranteDto>) {
        const db = this.supabase.getClient();
        
        // Verificar si la cédula ya la tiene otro aspirante (si se está cambiando la cédula)
        if (dto.cedula) {
            const { data: existing } = await db.from('aspirantes')
                .select('id')
                .eq('cedula', dto.cedula)
                .neq('id', id)
                .maybeSingle();
            if (existing) {
                throw new BadRequestException('Ya existe otro aspirante con esa cédula.');
            }
        }

        const { data, error } = await db.from('aspirantes').update(dto).eq('id', id).select().single();
        if (error) throw new InternalServerErrorException(error.message);
        return data;
    }

    // ==========================================
    // 4. GESTIÓN DE INTENTOS (PROGRAMACIÓN)
    // ==========================================

    async scheduleIntento(dto: ProgramarIntentoDto) {
        const db = this.supabase.getClient();

        // El token se genera automático por default en DB (gen_random_uuid()), pero lo necesitamos retornar.
        // Supabase insert return * nos dará el token.

        const { data, error } = await db.from('aspirantes_intentos_prueba').insert({
            aspirante_id: dto.aspirante_id,
            prueba_id: dto.prueba_id,
            fecha_programada: dto.fecha_programada,
            hora_inicio: dto.hora_inicio,
            hora_fin: dto.hora_fin,
            direccion: dto.direccion,
            latitud: dto.latitud,
            longitud: dto.longitud,
            radio_metros: dto.radio_metros || 100
        }).select().single();

        if (error) throw new InternalServerErrorException(error.message);

        // Generar links
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:4200'; // Ajustar según env
        const testLink = `${baseUrl}/aspirantes/prueba/${data.token}`;

        return {
            message: 'Prueba programada exitosamente',
            intento: data,
            link: testLink
        };
    }

    async rescheduleIntento(id: number, dto: ReprogramarIntentoDto) {
        const db = this.supabase.getClient();
        const updates: any = {};
        if (dto.fecha_programada) updates.fecha_programada = dto.fecha_programada;
        if (dto.hora_inicio) updates.hora_inicio = dto.hora_inicio;
        if (dto.hora_fin) updates.hora_fin = dto.hora_fin;
        if (dto.direccion) updates.direccion = dto.direccion;
        if (dto.latitud) updates.latitud = dto.latitud;
        if (dto.longitud) updates.longitud = dto.longitud;

        const { data, error } = await db.from('aspirantes_intentos_prueba').update(updates).eq('id', id).select().single();
        if (error) throw new InternalServerErrorException(error.message);
        return data;
    }

    async getIntento(id: number) {
        const db = this.supabase.getClient();
        const { data, error } = await db.from('aspirantes_intentos_prueba')
            .select('*, aspirantes(*), aspirantes_pruebas(*)')
            .eq('id', id)
            .single();
        if (error) throw new NotFoundException('Intento no encontrado');
        return data;
    }

    async deleteIntento(id: number) {
        const db = this.supabase.getClient();
        const { error } = await db.from('aspirantes_intentos_prueba').delete().eq('id', id);
        if (error) throw new InternalServerErrorException(error.message);
        return { message: 'Intento eliminado' };
    }

    async invalidateToken(id: number) {
        // No hay campo "invalidated", pero podemos usar fecha_fin_real o presentado = true para bloquear, 
        // O simplemente borrar el intento y crear otro. 
        // O mejor, actualizar fecha_programada a ayer.
        // Vamos a asumir que "invalidar" es cancelar.
        const db = this.supabase.getClient();
        const { error } = await db.from('aspirantes_intentos_prueba').update({
            fecha_inicio_real: new Date(),
            fecha_fin_real: new Date(),
            presentado: true,
            aprobado: false // Invalida como reprobado por defecto o cancelado
        }).eq('id', id);

        if (error) throw new InternalServerErrorException(error.message);
        return { message: 'Token invalidado (Marcado como finalizado/cancelado)' };
    }

    async generateShareLink(id: number) {
        const intento = await this.getIntento(id);
        const aspirante = intento.aspirantes;
        const baseUrl = process.env.FRONTEND_URL || 'https://app.proliseg.com';
        const link = `${baseUrl}/public/aspirantes/prueba/${intento.token}`;

        const mensaje = `Hola ${aspirante.nombre_completo}, tienes una prueba programada con PROLISEG.\n\n📅 Fecha: ${intento.fecha_programada}\n⏰ Hora: ${intento.hora_inicio} - ${intento.hora_fin}\n📍 Lugar: ${intento.direccion}\n\nIngresa al siguiente enlace únicamente cuando estés en el sitio: ${link}`;

        const whatsappUrl = `https://wa.me/${aspirante.telefono}?text=${encodeURIComponent(mensaje)}`;

        return {
            link,
            mensaje,
            whatsapp_url: whatsappUrl,
            email_data: {
                subject: 'Citación a Prueba Técnica - PROLISEG',
                body: mensaje
            }
        };
    }

    // ==========================================
    // 5. PUBLIC API (TOKEN BASED)
    // ==========================================

    async validateToken(token: string, lat?: number, lng?: number) {
        const db = this.supabase.getClient();
        const { data: intento, error } = await db
            .from('aspirantes_intentos_prueba')
            .select('*, aspirantes(nombre_completo), aspirantes_pruebas(*)')
            .eq('token', token)
            .single();

        if (error || !intento) throw new NotFoundException('Token inválido o no encontrado');

        // 1. Validar si ya finalizó
        if (intento.presentado || intento.fecha_fin_real) {
            throw new BadRequestException('Esta prueba ya fue presentada o finalizada.');
        }

        // 2. Validar Fecha - Using Colombia timezone (UTC-5)
        const ahora = new Date();
        const colombiaOffset = -5 * 60; // Colombia is UTC-5 in minutes
        const localDate = new Date(ahora.getTime() + (colombiaOffset + ahora.getTimezoneOffset()) * 60000);
        const hoy = localDate.toISOString().split('T')[0];

        if (intento.fecha_programada !== hoy) {
            throw new BadRequestException(`La prueba está programada para el ${intento.fecha_programada}. Hoy es ${hoy}.`);
        }

        // 3. Validar Hora - Using Colombia timezone (UTC-5)
        // Get current time in Colombia (UTC-5)
        const localTime = new Date(ahora.getTime() + (colombiaOffset + ahora.getTimezoneOffset()) * 60000);
        const horaActual = localTime.toTimeString().split(' ')[0]; // HH:MM:SS in Colombia time

        if (horaActual < intento.hora_inicio || horaActual > intento.hora_fin) {
            throw new BadRequestException(`La prueba está disponible entre ${intento.hora_inicio} y ${intento.hora_fin}.`);
        }

        // 4. Validar Ubicación (Radio)
        if (lat && lng && intento.latitud && intento.longitud) {
            const distancia = this.calcularDistancia(lat, lng, intento.latitud, intento.longitud);
            if (distancia > intento.radio_metros) {
                throw new BadRequestException(`Estás fuera del rango permitido (${intento.radio_metros}m). Distancia actual: ${distancia.toFixed(0)}m.`);
            }
        }

        return intento;
    }

    async startTest(token: string) {
        const db = this.supabase.getClient();
        // Validar token primero (sin coordenadas para start, asumimos validado en paso previo o frontend envía)
        // Aquí solo marcamos inicio real
        const { data: intento } = await db.from('aspirantes_intentos_prueba').select('id').eq('token', token).single();
        if (!intento) throw new NotFoundException('Token no válido');

        await db.from('aspirantes_intentos_prueba').update({
            fecha_inicio_real: new Date()
        }).eq('id', intento.id);

        // Retornar preguntas (sin marcar correcta)
        // Necesitamos query complejo: pruebas -> preguntas -> opciones (sin es_correcta)

        // Obtener prueba_id
        const { data: fullIntento } = await db.from('aspirantes_intentos_prueba').select('prueba_id').eq('id', intento.id).single();

        if (!fullIntento) throw new NotFoundException('No se encontraron detalles del intento');

        const { data: preguntas } = await db
            .from('aspirantes_preguntas')
            .select(`
        id, pregunta, orden,
        opciones:aspirantes_preguntas_opciones(id, texto, orden)
      `)
            .eq('prueba_id', fullIntento.prueba_id)
            .eq('activa', true)
            .order('orden', { ascending: true });

        return { message: 'Prueba iniciada', preguntas: preguntas || [] };
    }

    async submitAnswer(token: string, dto: SubmitRespuestaDto) {
        const db = this.supabase.getClient();
        const { data: intento } = await db.from('aspirantes_intentos_prueba').select('id').eq('token', token).single();
        if (!intento) throw new NotFoundException('Intento no encontrado');

        // Verificar si es correcta
        const { data: opcion } = await db.from('aspirantes_preguntas_opciones').select('es_correcta').eq('id', dto.opcion_id).single();
        const esCorrecta = opcion?.es_correcta || false;

        // Guardar o actualizar respuesta
        // Upsert para permitir cambiar respuesta si no ha finalizado
        // Verificar si ya existe respuesta para esa pregunta e intento
        const { data: existing } = await db.from('aspirantes_respuestas')
            .select('id')
            .eq('intento_id', intento.id)
            .eq('pregunta_id', dto.pregunta_id)
            .single();

        if (existing) {
            await db.from('aspirantes_respuestas').update({
                opcion_id: dto.opcion_id,
                es_correcta: esCorrecta
            }).eq('id', existing.id);
        } else {
            await db.from('aspirantes_respuestas').insert({
                intento_id: intento.id,
                pregunta_id: dto.pregunta_id,
                opcion_id: dto.opcion_id,
                es_correcta: esCorrecta
            });
        }

        return { success: true };
    }

    async finishTest(token: string) {
        const db = this.supabase.getClient();
        const { data: intento } = await db.from('aspirantes_intentos_prueba')
            .select('*, aspirantes_pruebas(*)')
            .eq('token', token)
            .single();

        if (!intento) throw new NotFoundException('Intento no encontrado');

        const prueba = intento.aspirantes_pruebas || {};
        const esPsicotecnica = prueba.tipo === 'psicotecnica' || 
            (prueba.nombre && (prueba.nombre.toUpperCase().includes('BUSS') || prueba.nombre.toUpperCase().includes('PSICO')));

        // Calcular puntaje
        const { count: totalPreguntas } = await db
            .from('aspirantes_preguntas')
            .select('*', { count: 'exact', head: true })
            .eq('prueba_id', intento.prueba_id)
            .eq('activa', true);

        const { count: respuestasCorrectas } = await db
            .from('aspirantes_respuestas')
            .select('*', { count: 'exact', head: true })
            .eq('intento_id', intento.id)
            .eq('es_correcta', true);

        const total = totalPreguntas || 0;
        const correctas = respuestasCorrectas || 0;
        const porcentaje = total > 0 ? Math.round((correctas / total) * 100) : 0;
        const minScore = prueba.puntaje_minimo || 70;

        let aprobado: boolean | null = porcentaje >= minScore;
        let dictamen: string | null = null;

        if (esPsicotecnica) {
            aprobado = null; // Requiere dictamen del psicólogo
            dictamen = 'PENDIENTE';
        }

        // Actualizar intento
        await db.from('aspirantes_intentos_prueba').update({
            fecha_fin_real: new Date(),
            presentado: true,
            porcentaje: porcentaje,
            aprobado: aprobado,
            dictamen_psicologico: dictamen
        }).eq('id', intento.id);

        if (!esPsicotecnica && aprobado) {
            await db.from('aspirantes').update({ estado: 'aprobado' }).eq('id', intento.aspirante_id);
        }

        // Generar PDF y guardar en bucket 'pruebas'
        try {
            const { buffer } = await this.generateTestReportPdfBuffer(intento.id);
            const adminSupabase = this.supabase.getSupabaseAdminClient();
            const fileName = `prueba-${intento.aspirante_id}-${intento.id}.pdf`;
            await adminSupabase.storage.from('pruebas').upload(fileName, buffer, { contentType: 'application/pdf', upsert: true });
            const { data: urlData } = adminSupabase.storage.from('pruebas').getPublicUrl(fileName);
            if (urlData?.publicUrl) {
                await db.from('aspirantes_intentos_prueba').update({ pdf_prueba_url: urlData.publicUrl }).eq('id', intento.id);
            }
        } catch (e) {
            this.logger.error('Error generando PDF de prueba en bucket pruebas:', e);
        }

        return {
            message: 'Prueba finalizada',
            resultado: {
                porcentaje,
                aprobado,
                totalPreguntas: total,
                respuestasCorrectas: correctas,
                esPsicotecnica,
                dictamen
            }
        };
    }

    async getResults(token: string) {
        const db = this.supabase.getClient();
        const { data: intento } = await db.from('aspirantes_intentos_prueba')
            .select('*, aspirantes_pruebas(*)')
            .eq('token', token)
            .single();
        if (!intento || !intento.presentado) throw new BadRequestException('Prueba no finalizada o no encontrada');

        const prueba = intento.aspirantes_pruebas || {};
        const esPsicotecnica = prueba.tipo === 'psicotecnica' || 
            (prueba.nombre && (prueba.nombre.toUpperCase().includes('BUSS') || prueba.nombre.toUpperCase().includes('PSICO')));

        // Obtener retroalimentación de las incorrectas
        const { data: preguntas } = await db.from('aspirantes_preguntas')
            .select('id, pregunta, retroalimentacion')
            .eq('prueba_id', intento.prueba_id)
            .order('orden', { ascending: true });

        // Obtener respuestas del usuario
        const { data: respuestas } = await db.from('aspirantes_respuestas')
            .select('pregunta_id, es_correcta, opcion_id')
            .eq('intento_id', intento.id);

        const detalle = (preguntas || []).map(p => {
            const resp = (respuestas || []).find(r => r.pregunta_id === p.id);
            const fueCorrecta = resp?.es_correcta || false;
            return {
                pregunta_id: p.id,
                pregunta: p.pregunta,
                correcta: fueCorrecta,
                retroalimentacion: fueCorrecta ? null : p.retroalimentacion
            };
        });

        return {
            aprobado: intento.aprobado,
            porcentaje: intento.porcentaje,
            dictamen_psicologico: intento.dictamen_psicologico,
            es_psicotecnica: esPsicotecnica,
            detalle
        };
    }

    // ==========================================
    // 6. DATOS PRE-EMPLEADO & CONTRATACIÓN
    // ==========================================

    async savePreEmploymentData(token: string, dto: SaveDatosPreEmpleadoDto) {
        const db = this.supabase.getClient();
        // Validar token y aprobación
        const { data: intento } = await db.from('aspirantes_intentos_prueba').select('aspirante_id, aprobado').eq('token', token).single();

        if (!intento || !intento.aprobado) throw new BadRequestException('Aspirante no autorizado o no aprobó la prueba');

        const aspiranteId = intento.aspirante_id;

        // Upsert datos pre-empleado
        // Verificar si ya existe para update
        const { data: existing } = await db.from('aspirantes_datos_pre_empleado').select('id').eq('aspirante_id', aspiranteId).single();

        let res;
        if (existing) {
            res = await db.from('aspirantes_datos_pre_empleado').update({ ...dto, completado: true }).eq('id', existing.id);
        } else {
            res = await db.from('aspirantes_datos_pre_empleado').insert({ ...dto, aspirante_id: aspiranteId, completado: true });
        }

        if (res.error) throw new InternalServerErrorException(res.error.message);
        return { message: 'Datos guardados correctamente' };
    }

    private browser: puppeteer.Browser | null = null;
    private readonly browserOptions: any = {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    };

    private async getBrowser() {
        if (!this.browser || !this.browser.connected) {
            this.browser = await puppeteer.launch(this.browserOptions);
            this.logger.log('Nuevo navegador Puppeteer iniciado para Aspirantes');
        }
        return this.browser;
    }

    async generateSeleccionPdfBuffer(aspiranteId: number): Promise<{ buffer: Buffer; data: any }> {
        const db = this.supabase.getClient();

        // 1. Obtener aspirante y datos pre-empleado
        const { data: aspirante } = await db.from('aspirantes').select('*').eq('id', aspiranteId).single();
        const { data: pre } = await db.from('aspirantes_datos_pre_empleado').select('*').eq('aspirante_id', aspiranteId).maybeSingle();
        
        // 2. Obtener intento de prueba más reciente
        const { data: intentos } = await db.from('aspirantes_intentos_prueba')
            .select('*, aspirantes_pruebas(*)')
            .eq('aspirante_id', aspiranteId)
            .order('created_at', { ascending: false });
        
        const ultimoIntento = (intentos || [])[0] || {};
        const pruebaInfo = ultimoIntento.aspirantes_pruebas || {};

        let respuestasCorrectas = 0;
        let totalPreguntas = 0;
        if (ultimoIntento.id) {
            const { count: cTotal } = await db.from('aspirantes_preguntas').select('*', { count: 'exact', head: true }).eq('prueba_id', ultimoIntento.prueba_id).eq('activa', true);
            const { count: cCorrectas } = await db.from('aspirantes_respuestas').select('*', { count: 'exact', head: true }).eq('intento_id', ultimoIntento.id).eq('es_correcta', true);
            totalPreguntas = cTotal || 0;
            respuestasCorrectas = cCorrectas || 0;
        }

        const templateData = {
            nombre_completo: pre?.nombre_completo || aspirante?.nombre_completo || 'Aspirante',
            cedula: pre?.cedula || aspirante?.cedula || '',
            fecha_expedicion: pre?.fecha_expedicion || '',
            lugar_expedicion: pre?.lugar_expedicion || '',
            fecha_nacimiento: pre?.fecha_nacimiento || '',
            genero: pre?.genero || '',
            rh: pre?.rh || '',
            telefono: pre?.telefono || aspirante?.telefono || '',
            correo: pre?.correo || aspirante?.correo || '',
            direccion: pre?.direccion || '',
            ciudad: pre?.ciudad || '',
            departamento: pre?.departamento || '',
            estado_civil: pre?.estado_civil || '',
            cargo: aspirante?.cargo_aspirado || 'Vigilante / Operativo',
            prueba_nombre: pruebaInfo.nombre || 'Prueba Técnica de Selección',
            fecha_prueba: ultimoIntento.fecha_fin_real ? new Date(ultimoIntento.fecha_fin_real).toLocaleDateString('es-CO') : new Date().toLocaleDateString('es-CO'),
            porcentaje: ultimoIntento.porcentaje != null ? ultimoIntento.porcentaje : 100,
            aprobado: ultimoIntento.aprobado !== false,
            respuestas_correctas: respuestasCorrectas,
            total_preguntas: totalPreguntas,
            puntaje_minimo: pruebaInfo.puntaje_minimo || 70,
            hoja_de_vida_url: pre?.hoja_de_vida_url || aspirante?.hoja_vida_url,
            certificado_curso_url: pre?.certificado_curso_url,
            certificado_bancario_url: pre?.certificado_bancario_url,
            eps_nombre: pre?.eps_id ? 'EPS Registrada' : null,
            arl_nombre: pre?.arl_id ? 'ARL Registrada' : null,
            fondo_pension_nombre: pre?.fondo_pension_id ? 'Fondo Pensión Registrado' : null
        };

        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
     @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
     body { font-family: 'Inter', sans-serif; color: #1e293b; margin: 0; padding: 25px; font-size: 11px; }
     .container { width: 100%; max-width: 900px; margin: 0 auto; }
     
     .report-header { display: flex; align-items: stretch; border: 1px solid #1e293b; margin-bottom: 15px; }
     .logo-area { width: 25%; display: flex; justify-content: center; align-items: center; border-right: 1px solid #1e293b; padding: 10px; }
     .logo-brand { text-align: center; line-height: 1; }
     .brand-top { display: block; font-size: 18px; font-weight: 800; color: #4680ff; text-transform: lowercase; }
     .brand-bottom { display: block; font-size: 12px; font-weight: 600; color: #4680ff; letter-spacing: 0.5px; }
     .title-area { width: 50%; display: flex; justify-content: center; align-items: center; border-right: 1px solid #1e293b; padding: 10px; text-align: center; }
     .title-area h1 { margin: 0; font-size: 13px; font-weight: 700; color: #1e293b; text-transform: uppercase; }
     .meta-area { width: 25%; font-size: 9px; }
     .meta-row { display: flex; border-bottom: 1px solid #1e293b; }
     .meta-row:last-child { border-bottom: none; }
     .meta-row span { width: 45%; border-right: 1px solid #1e293b; padding: 4px 6px; font-weight: 600; background: #f8fafc; }
     .meta-row strong { width: 55%; padding: 4px 6px; }
     
     .section-title { font-size: 11px; font-weight: 700; background: #f1f5f9; padding: 6px 10px; border: 1px solid #1e293b; border-bottom: none; margin-top: 12px; color: #0f172a; text-transform: uppercase; }
     .info-table { width: 100%; border-collapse: collapse; border: 1px solid #1e293b; margin-bottom: 10px; font-size: 10px; }
     .info-table td, .info-table th { border: 1px solid #1e293b; padding: 6px 8px; vertical-align: middle; }
     .info-table th { background-color: #f8fafc; font-weight: 600; width: 22%; color: #334155; }
     .info-table td { width: 28%; color: #0f172a; }
     
     .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-weight: 700; font-size: 9px; text-transform: uppercase; }
     .badge-success { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
     .badge-danger { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }

     .signatures-container { display: flex; justify-content: space-between; margin-top: 40px; page-break-inside: avoid; }
     .signature-box { width: 45%; text-align: center; border-top: 1px solid #1e293b; padding-top: 5px; }
     .signature-box p { margin: 2px 0; font-size: 10px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="report-header">
      <div class="logo-area">
        <div class="logo-brand">
          <span class="brand-top">proliseg</span>
          <span class="brand-bottom">Prolicontrol</span>
        </div>
      </div>
      <div class="title-area">
        <h1>SELECCIÓN Y CONTRATACIÓN DEL PERSONAL</h1>
      </div>
      <div class="meta-area">
        <div class="meta-row"><span>Código:</span> <strong>SIG-GH-F-05</strong></div>
        <div class="meta-row"><span>Versión:</span> <strong>2</strong></div>
        <div class="meta-row"><span>Fecha Aprob:</span> <strong>1/04/2026</strong></div>
        <div class="meta-row"><span>Página:</span> <strong>1 de 1</strong></div>
      </div>
    </div>

    <div class="section-title">1. DATOS DE IDENTIFICACIÓN DEL ASPIRANTE</div>
    <table class="info-table">
      <tr>
        <th>Nombre Completo:</th>
        <td><strong>${templateData.nombre_completo}</strong></td>
        <th>Cédula de Ciudadanía:</th>
        <td>${templateData.cedula}</td>
      </tr>
      <tr>
        <th>Fecha Expedición:</th>
        <td>${templateData.fecha_expedicion}</td>
        <th>Lugar Expedición:</th>
        <td>${templateData.lugar_expedicion}</td>
      </tr>
      <tr>
        <th>Fecha Nacimiento:</th>
        <td>${templateData.fecha_nacimiento}</td>
        <th>Género / RH:</th>
        <td>${templateData.genero} / ${templateData.rh}</td>
      </tr>
      <tr>
        <th>Teléfono Principal:</th>
        <td>${templateData.telefono}</td>
        <th>Correo Electrónico:</th>
        <td>${templateData.correo}</td>
      </tr>
      <tr>
        <th>Dirección Residencial:</th>
        <td>${templateData.direccion}</td>
        <th>Ciudad / Dpto:</th>
        <td>${templateData.ciudad}, ${templateData.departamento}</td>
      </tr>
      <tr>
        <th>Estado Civil:</th>
        <td>${templateData.estado_civil}</td>
        <th>Cargo al que Aplica:</th>
        <td>${templateData.cargo}</td>
      </tr>
    </table>

    <div class="section-title">2. RESULTADO DE EVALUACIÓN Y PRUEBAS</div>
    <table class="info-table">
      <tr>
        <th>Prueba Evaluada:</th>
        <td>${templateData.prueba_nombre}</td>
        <th>Fecha Presentación:</th>
        <td>${templateData.fecha_prueba}</td>
      </tr>
      <tr>
        <th>Porcentaje Obtenido:</th>
        <td><strong>${templateData.porcentaje}%</strong></td>
        <th>Resultado Final:</th>
        <td>
          <span class="badge ${templateData.aprobado ? 'badge-success' : 'badge-danger'}">
            ${templateData.aprobado ? 'APROBADO PARA CONTRATACIÓN' : 'NO APROBADO'}
          </span>
        </td>
      </tr>
      <tr>
        <th>Respuestas Correctas:</th>
        <td>${templateData.respuestas_correctas} / ${templateData.total_preguntas}</td>
        <th>Puntaje Mínimo Requerido:</th>
        <td>${templateData.puntaje_minimo}%</td>
      </tr>
    </table>

    <div class="section-title">3. VERIFICACIÓN Y DOCUMENTACIÓN DE REQUISITOS</div>
    <table class="info-table">
      <tr>
        <th>Hoja de Vida y Soportes:</th>
        <td>${templateData.hoja_de_vida_url ? 'VERIFICADO Y ADJUNTADO' : 'PENDIENTE'}</td>
        <th>Curso de Vigilancia / Capacitación:</th>
        <td>${templateData.certificado_curso_url ? 'VERIFICADO Y ADJUNTADO' : 'COMPLETADO'}</td>
      </tr>
      <tr>
        <th>Examen Médico de Ingreso:</th>
        <td>VERIFICADO Y APTO</td>
        <th>Certificado Bancario:</th>
        <td>${templateData.certificado_bancario_url ? 'ADJUNTADO' : 'PENDIENTE'}</td>
      </tr>
      <tr>
        <th>Afiliaciones Seguridad Social:</th>
        <td colspan="3">EPS, ARL, Fondo Pensión y Caja de Compensación asignados conforme a la normativa.</td>
      </tr>
    </table>

    <div class="section-title">4. FIRMAS DE APROBACIÓN Y CONTRATACIÓN</div>
    <div class="signatures-container">
      <div class="signature-box">
        <br><br>
        <p>_____________________________________</p>
        <p><strong>Firma del Aspirante / Trabajador</strong></p>
        <p>C.C. ${templateData.cedula}</p>
      </div>
      <div class="signature-box">
        <br><br>
        <p>_____________________________________</p>
        <p><strong>Gestión Humana y Selección</strong></p>
        <p>PROLISEG SEGURIDAD PRIVADA</p>
      </div>
    </div>
  </div>
</body>
</html>
        `;

        const browser = await this.getBrowser();
        const page = await browser.newPage();
        try {
            await page.setContent(htmlContent, { waitUntil: 'domcontentloaded', timeout: 60000 });
            const pdfUint8Array = await page.pdf({
                format: 'Letter',
                printBackground: true,
                margin: { top: '10mm', right: '10mm', bottom: '15mm', left: '10mm' }
            });
            return { buffer: Buffer.from(pdfUint8Array), data: templateData };
        } finally {
            await page.close();
        }
    }

    async exportSeleccionPdf(aspiranteId: number, res: Response) {
        try {
            const { buffer, data } = await this.generateSeleccionPdfBuffer(aspiranteId);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=SIG-GH-F-05_${data.cedula}.pdf`);
            res.send(buffer);
        } catch (error) {
            this.logger.error(`Error generando PDF SIG-GH-F-05 para aspirante ${aspiranteId}:`, error);
            if (!res.headersSent) {
                res.status(500).json({ message: 'Error al generar el PDF SIG-GH-F-05', error: error.message });
            }
        }
    }

    private normalizarFirmaParaPdf(firma?: string): string {
        const valor = firma?.trim() || '';
        if (!valor || valor.startsWith('data:image') || /^https?:\/\//i.test(valor)) return valor;
        return `data:image/png;base64,${valor}`;
    }

    async generateTestReportPdfBuffer(intentoId: number): Promise<{ buffer: Buffer; data: any }> {
        const db = this.supabase.getClient();

        const { data: intento } = await db.from('aspirantes_intentos_prueba')
            .select('*, aspirantes(*), aspirantes_pruebas(*)')
            .eq('id', intentoId)
            .single();

        if (!intento) throw new NotFoundException('Intento no encontrado');

        const aspirante = intento.aspirantes || {};
        const prueba = intento.aspirantes_pruebas || {};
        const esPsicotecnica = prueba.tipo === 'psicotecnica' || 
            (prueba.nombre && (prueba.nombre.toUpperCase().includes('BUSS') || prueba.nombre.toUpperCase().includes('PSICO')));

        const { data: respuestas } = await db.from('aspirantes_respuestas')
            .select('pregunta_id, opcion_id, es_correcta')
            .eq('intento_id', intentoId);

        // The technical report needs every option to identify the selected one and correct answer.
        const { data: preguntas } = await db.from('aspirantes_preguntas')
            .select('id, pregunta, orden, opciones:aspirantes_preguntas_opciones(id, texto, orden, es_correcta)')
            .eq('prueba_id', intento.prueba_id)
            .eq('activa', true)
            .order('orden', { ascending: true });

        const preguntasOrdenadas = (preguntas || []).sort((a: any, b: any) =>
            (a.orden || 0) - (b.orden || 0)
        );
        const respuestasPorPregunta = new Map<number, any>(
            (respuestas || []).map((respuesta: any) => [respuesta.pregunta_id, respuesta])
        );
        const respuestasCorrectas = (respuestas || []).filter((respuesta: any) => respuesta.es_correcta === true).length;
        const totalPreguntas = preguntasOrdenadas.length;
        const respuestasIncorrectas = Math.max(totalPreguntas - respuestasCorrectas, 0);
        const porcentajeNumerico = Number(intento.porcentaje ?? 0);
        const firmaEvaluador = this.normalizarFirmaParaPdf(intento.evaluador_firma_url || '');

        const dataReporte = {
            nombre_completo: aspirante.nombre_completo || 'Aspirante',
            cedula: aspirante.cedula || 'N/A',
            prueba_nombre: prueba.nombre || 'Prueba de Selección',
            es_psicotecnica: esPsicotecnica,
            fecha_presentacion: intento.fecha_fin_real ? new Date(intento.fecha_fin_real).toLocaleDateString('es-CO') : new Date().toLocaleDateString('es-CO'),
            porcentaje: Number.isFinite(porcentajeNumerico) ? porcentajeNumerico.toFixed(0) : '0',
            aprobado: intento.aprobado,
            dictamen: intento.dictamen_psicologico || (esPsicotecnica ? 'PENDIENTE' : (intento.aprobado ? 'APROBADO' : 'REPROBADO')),
            observaciones_evaluacion: intento.observaciones_evaluacion || '',
            evaluado_por_nombre: intento.evaluado_por_nombre || '',
            evaluador_firma_url: firmaEvaluador,
            fecha_evaluacion: intento.fecha_evaluacion ? new Date(intento.fecha_evaluacion).toLocaleDateString('es-CO') : '',
            codigo: esPsicotecnica ? 'SIG-GH-F-03' : 'SIG-GH-F-05',
            titulo: esPsicotecnica ? 'CUESTIONARIO MODIFICADO BUSS-DURKEE' : 'PRUEBA TÉCNICA',
            total_preguntas: totalPreguntas,
            respuestas_correctas: respuestasCorrectas,
            respuestas_incorrectas: respuestasIncorrectas,
            preguntas: preguntasOrdenadas.map((pregunta: any) => {
                const respuesta = respuestasPorPregunta.get(pregunta.id);
                return {
                    orden: pregunta.orden || '-',
                    pregunta: pregunta.pregunta || 'Pregunta',
                    opcion_seleccionada_id: respuesta?.opcion_id || null,
                    opciones: (pregunta.opciones || [])
                        .sort((a: any, b: any) => (a.orden || 0) - (b.orden || 0))
                        .map((opcion: any) => ({ id: opcion.id, texto: opcion.texto || '', es_correcta: opcion.es_correcta }))
                };
            })
        };

        // Generar tabla de 91 preguntas V/F en 2 columnas para Buss-Durkee / Psicotécnica
        let bussDurkeeTableHtml = '';
        if (esPsicotecnica && preguntasOrdenadas.length > 0) {
            const totalQ = preguntasOrdenadas.length;
            const halfQ = Math.ceil(totalQ / 2);
            const col1 = preguntasOrdenadas.slice(0, halfQ);
            const col2 = preguntasOrdenadas.slice(halfQ);

            let rowsHtml = '';
            for (let i = 0; i < halfQ; i++) {
                const q1 = col1[i];
                const q2 = col2[i];

                const getSelection = (q: any) => {
                    if (!q) return { isV: false, isF: false };
                    const resp = respuestasPorPregunta.get(q.id);
                    if (!resp || !resp.opcion_id) return { isV: false, isF: false };
                    const optSel = (q.opciones || []).find((o: any) => o.id === resp.opcion_id);
                    if (!optSel) return { isV: false, isF: false };
                    const txt = (optSel.texto || '').toUpperCase().trim();
                    const isV = txt.startsWith('V') || txt.startsWith('SI') || txt.startsWith('SÍ') || txt === '1';
                    const isF = txt.startsWith('F') || txt.startsWith('NO') || txt === '2';
                    return { isV, isF: !isV ? isF : false };
                };

                const s1 = getSelection(q1);
                const s2 = getSelection(q2);

                rowsHtml += `
                <tr>
                    <td style="text-align: center; font-weight: 700;">${q1 ? (q1.orden || (i + 1)) : ''}</td>
                    <td style="font-size: 8px;">${q1 ? q1.pregunta : ''}</td>
                    <td style="text-align: center; font-weight: 900; color: #dc2626; font-size: 10px;">${s1.isV ? 'X' : ''}</td>
                    <td style="text-align: center; font-weight: 900; color: #dc2626; font-size: 10px;">${s1.isF ? 'X' : ''}</td>

                    <td style="text-align: center; font-weight: 700; border-left: 2px solid #1e293b;">${q2 ? (q2.orden || (halfQ + i + 1)) : ''}</td>
                    <td style="font-size: 8px;">${q2 ? q2.pregunta : ''}</td>
                    <td style="text-align: center; font-weight: 900; color: #dc2626; font-size: 10px;">${q2 && s2.isV ? 'X' : ''}</td>
                    <td style="text-align: center; font-weight: 900; color: #dc2626; font-size: 10px;">${q2 && s2.isF ? 'X' : ''}</td>
                </tr>
                `;
            }

            bussDurkeeTableHtml = `
            <table class="info-table buss-table">
                <thead>
                    <tr>
                        <th style="width: 4%; text-align: center;">N°</th>
                        <th style="width: 38%;">Pregunta</th>
                        <th style="width: 4%; background-color: #dcfce7; color: #166534; text-align: center;">V</th>
                        <th style="width: 4%; background-color: #fee2e2; color: #991b1b; text-align: center;">F</th>
                        <th style="width: 4%; text-align: center; border-left: 2px solid #1e293b;">N°</th>
                        <th style="width: 38%;">Pregunta</th>
                        <th style="width: 4%; background-color: #dcfce7; color: #166534; text-align: center;">V</th>
                        <th style="width: 4%; background-color: #fee2e2; color: #991b1b; text-align: center;">F</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
            `;
        }

        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
     @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
     body { font-family: 'Inter', sans-serif; color: #1e293b; margin: 0; padding: 20px; font-size: 10px; }
     .container { width: 100%; max-width: 900px; margin: 0 auto; }
     
     .report-header { display: flex; align-items: stretch; border: 1px solid #1e293b; margin-bottom: 12px; }
     .logo-area { width: 25%; display: flex; justify-content: center; align-items: center; border-right: 1px solid #1e293b; padding: 8px; }
     .logo-brand { text-align: center; line-height: 1; }
     .brand-top { display: block; font-size: 16px; font-weight: 800; color: #4680ff; text-transform: lowercase; }
     .brand-bottom { display: block; font-size: 11px; font-weight: 600; color: #4680ff; letter-spacing: 0.5px; }
     .title-area { width: 50%; display: flex; justify-content: center; align-items: center; border-right: 1px solid #1e293b; padding: 8px; text-align: center; }
     .title-area h1 { margin: 0; font-size: 12px; font-weight: 700; color: #1e293b; text-transform: uppercase; }
     .meta-area { width: 25%; font-size: 9px; }
     .meta-row { display: flex; border-bottom: 1px solid #1e293b; }
     .meta-row:last-child { border-bottom: none; }
     .meta-row span { width: 45%; border-right: 1px solid #1e293b; padding: 3px 5px; font-weight: 600; background: #f8fafc; }
     .meta-row strong { width: 55%; padding: 3px 5px; }
     
     .section-title { font-size: 10px; font-weight: 700; background: #f1f5f9; padding: 5px 8px; border: 1px solid #1e293b; border-bottom: none; margin-top: 12px; color: #0f172a; text-transform: uppercase; }
     .info-table { width: 100%; border-collapse: collapse; border: 1px solid #1e293b; margin-bottom: 10px; font-size: 9px; }
     .info-table td, .info-table th { border: 1px solid #1e293b; padding: 5px 6px; vertical-align: middle; }
     .info-table th { background-color: #f8fafc; font-weight: 600; width: 22%; color: #334155; }
     .info-table td { color: #0f172a; }
     
     .buss-table th { font-size: 9px; }
     .buss-table td { font-size: 8px; padding: 3px 4px; }

     .badge { display: inline-block; padding: 2px 6px; border-radius: 3px; font-weight: 700; font-size: 9px; text-transform: uppercase; }
     .badge-success { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
     .badge-danger { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
     .badge-warning { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }

     /* TARJETA DE RESULTADO TÉCNICO EN FONDO BLANCO */
     .score-summary { display: flex; border: 2px solid #cbd5e1; background: #ffffff; margin: 12px 0; border-radius: 8px; overflow: hidden; page-break-inside: avoid; }
     .score-main { width: 34%; padding: 12px 10px; text-align: center; color: #0f172a; background: #ffffff; border-right: 2px solid #cbd5e1; }
     .score-main.score-pass { border-color: #22c55e; color: #15803d; }
     .score-main.score-fail { border-color: #ef4444; color: #b91c1c; }
     .score-label { display: block; font-size: 8px; font-weight: 700; letter-spacing: .3px; text-transform: uppercase; color: #64748b; }
     .score-main strong { display: block; margin-top: 2px; font-size: 26px; line-height: 1; font-weight: 800; }
     .score-main.score-fail strong { color: #dc2626; }
     .score-main.score-pass strong { color: #16a34a; }
     .score-main small { display: block; margin-top: 4px; font-size: 9px; font-weight: 700; }
     .score-item { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 7px 5px; text-align: center; border-left: 1px solid #e2e8f0; }
     .score-item .score-value { margin-top: 2px; font-size: 18px; font-weight: 700; color: #0f172a; }

     .questions-section { border: 1px solid #1e293b; border-top: none; }
     .question-card { padding: 8px 10px; border-bottom: 1px solid #cbd5e1; page-break-inside: avoid; }
     .question-card:last-child { border-bottom: none; }
     .question-heading { display: flex; gap: 4px; font-size: 10px; font-weight: 700; color: #0f172a; }
     .question-number { min-width: 15px; }
     .options-list { margin: 5px 0 0 20px; }
     .option-row { display: flex; gap: 7px; margin: 3px 0; color: #1e293b; }
     .option-letter { width: 11px; flex: 0 0 11px; }
     .option-row.selected-correct { font-weight: 700; color: #15803d; }
     .option-row.selected-correct .option-text { text-decoration: underline; text-decoration-color: #22c55e; text-decoration-thickness: 2px; text-underline-offset: 3px; }
     .option-row.selected-incorrect { font-weight: 700; color: #b91c1c; }
     .option-row.selected-incorrect .option-text { text-decoration: underline; text-decoration-color: #ef4444; text-decoration-thickness: 2px; text-underline-offset: 3px; }
     .option-row.correct-answer { font-weight: 700; color: #15803d; }
     .option-row.correct-answer .option-text { text-decoration: underline; text-decoration-color: #22c55e; text-decoration-thickness: 2px; text-underline-offset: 3px; }
     .no-answer { margin: 5px 0 0 20px; font-style: italic; color: #64748b; }

     .evaluator-box { border: 1px solid #1e293b; background: #fafafa; padding: 12px; margin-top: 10px; page-break-inside: avoid; }
     
     /* FIRMA DEL PROFESIONAL EVALUADOR CENTRADA AL FINAL */
     .evaluator-signature-centered { width: 280px; margin: 30px auto 10px auto; text-align: center; page-break-inside: avoid; }
     .evaluator-signature-centered img { max-width: 200px; max-height: 60px; display: block; margin: 0 auto 5px auto; object-fit: contain; }
     .signature-line { border-top: 1px solid #1e293b; padding-top: 4px; font-size: 9px; font-weight: 700; text-transform: uppercase; color: #0f172a; }
     .signature-name { font-size: 9px; margin-top: 2px; color: #334155; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="report-header">
      <div class="logo-area">
        <div class="logo-brand">
          <span class="brand-top">proliseg</span>
          <span class="brand-bottom">Prolicontrol</span>
        </div>
      </div>
      <div class="title-area">
        <h1>REPORTE DE EVALUACIÓN - ${dataReporte.titulo}</h1>
      </div>
      <div class="meta-area">
        <div class="meta-row"><span>Código:</span> <strong>${dataReporte.codigo}</strong></div>
        <div class="meta-row"><span>Versión:</span> <strong>2</strong></div>
        <div class="meta-row"><span>Fecha Aprob:</span> <strong>1/04/2026</strong></div>
        <div class="meta-row"><span>Página:</span> <strong>1 de 1</strong></div>
      </div>
    </div>

    ${!dataReporte.es_psicotecnica ? `
    <div class="score-summary ${dataReporte.aprobado ? 'score-pass' : 'score-fail'}">
      <div class="score-main ${dataReporte.aprobado ? 'score-pass' : 'score-fail'}">
        <span class="score-label">Calificación final</span>
        <strong>${dataReporte.porcentaje}%</strong>
        <small>${dataReporte.aprobado ? 'APROBADO' : 'REPROBADO'}</small>
      </div>
      <div class="score-item">
        <span class="score-label">Respuestas buenas</span>
        <span class="score-value">${dataReporte.respuestas_correctas}</span>
      </div>
      <div class="score-item">
        <span class="score-label">Respuestas malas</span>
        <span class="score-value">${dataReporte.respuestas_incorrectas}</span>
      </div>
      <div class="score-item">
        <span class="score-label">Total preguntas</span>
        <span class="score-value">${dataReporte.total_preguntas}</span>
      </div>
    </div>
    ` : ''}

    <div class="section-title">1. DATOS DEL ASPIRANTE Y DETALLES DE LA PRUEBA</div>
    <table class="info-table">
      <tr>
        <th>Candidato(a):</th>
        <td><strong>${dataReporte.nombre_completo}</strong></td>
        <th>Cédula:</th>
        <td>${dataReporte.cedula}</td>
      </tr>
      <tr>
        <th>Prueba Presentada:</th>
        <td>${dataReporte.prueba_nombre}</td>
        <th>Fecha Presentación:</th>
        <td>${dataReporte.fecha_presentacion}</td>
      </tr>
      <tr>
        <th>Tipo de Prueba:</th>
        <td>${dataReporte.es_psicotecnica ? 'Psicotécnica / Personalidad' : 'Conocimientos Técnicos'}</td>
        <th>Resultado / Dictamen:</th>
        <td>
          <span class="badge ${dataReporte.dictamen === 'APTO' || dataReporte.aprobado === true ? 'badge-success' : (dataReporte.dictamen === 'PENDIENTE' ? 'badge-warning' : 'badge-danger')}">
            ${dataReporte.dictamen}
          </span>
        </td>
      </tr>
    </table>

    <div class="section-title">${dataReporte.es_psicotecnica ? '2. RESPUESTAS DEL ASPIRANTE (CUESTIONARIO PSICOTÉCNICO)' : '2. CUESTIONARIO Y RESPUESTAS DEL ASPIRANTE'}</div>
    ${dataReporte.es_psicotecnica ? bussDurkeeTableHtml : `
    <div class="questions-section">
      ${dataReporte.preguntas.map((pregunta: any) => `
        <div class="question-card">
          <div class="question-heading"><span class="question-number">${pregunta.orden}.</span><span>${pregunta.pregunta}</span></div>
          ${pregunta.opciones.length ? `
            <div class="options-list">
              ${pregunta.opciones.map((opcion: any, indice: number) => {
                const esSeleccionada = opcion.id === pregunta.opcion_seleccionada_id;
                const esCorrecta = opcion.es_correcta === true;
                let classRow = '';
                let labelTag = '';

                if (esSeleccionada && esCorrecta) {
                    classRow = 'selected-correct';
                    labelTag = ' <small style="color: #16a34a; font-weight: 700;">(Marcada por aspirante - Correcta)</small>';
                } else if (esSeleccionada && !esCorrecta) {
                    classRow = 'selected-incorrect';
                    labelTag = ' <small style="color: #dc2626; font-weight: 700;">(Marcada por aspirante - Incorrecta)</small>';
                } else if (!esSeleccionada && esCorrecta) {
                    classRow = 'correct-answer';
                    labelTag = ' <small style="color: #16a34a; font-weight: 700;">(Respuesta Correcta)</small>';
                }

                return `
                <div class="option-row ${classRow}">
                  <span class="option-letter">${String.fromCharCode(97 + indice)}.</span>
                  <span class="option-text">${opcion.texto}${labelTag}</span>
                </div>
                `;
              }).join('')}
            </div>
          ` : '<div class="no-answer">Sin opciones registradas.</div>'}
          ${pregunta.opcion_seleccionada_id ? '' : '<div class="no-answer">Sin respuesta seleccionada.</div>'}
        </div>
      `).join('')}
    </div>
    `}

    ${dataReporte.es_psicotecnica ? `
    <div class="section-title">3. EVALUACIÓN Y DICTAMEN PSICOLÓGICO</div>
    <div class="evaluator-box">
      <p style="margin: 0 0 5px 0;"><strong>Dictamen Final:</strong> 
        <span class="badge ${dataReporte.dictamen === 'APTO' ? 'badge-success' : (dataReporte.dictamen === 'PENDIENTE' ? 'badge-warning' : 'badge-danger')}">
          ${dataReporte.dictamen}
        </span>
      </p>
      <p style="margin: 5px 0;"><strong>Observaciones del Evaluador(a):</strong> ${dataReporte.observaciones_evaluacion || 'Sin observaciones registradas.'}</p>
      ${dataReporte.evaluado_por_nombre ? `
      <div style="margin-top: 10px; border-top: 1px solid #cbd5e1; padding-top: 5px;">
        <p style="margin: 2px 0;"><strong>Evaluado por:</strong> ${dataReporte.evaluado_por_nombre}</p>
        <p style="margin: 2px 0;"><strong>Fecha Evaluación:</strong> ${dataReporte.fecha_evaluacion}</p>
      </div>
      ` : '<p style="margin: 5px 0; color: #64748b;"><em>Pendiente por evaluar por el/la profesional de Gestión Humana.</em></p>'}
    </div>
    ` : ''}

    <!-- FIRMA DEL EVALUADOR CENTRADA AL FINAL -->
    ${dataReporte.evaluado_por_nombre || dataReporte.evaluador_firma_url ? `
      <div class="evaluator-signature-centered">
        ${dataReporte.evaluador_firma_url ? `<img src="${dataReporte.evaluador_firma_url}" alt="Firma del evaluador">` : '<div style="height: 50px;"></div>'}
        <div class="signature-line">Firma del profesional evaluador(a)</div>
        <div class="signature-name">${dataReporte.evaluado_por_nombre || ''}</div>
      </div>
    ` : ''}

  </div>
</body>
</html>
        `;

        const browser = await this.getBrowser();
        const page = await browser.newPage();
        try {
            await page.setContent(htmlContent, { waitUntil: 'domcontentloaded', timeout: 60000 });
            const pdfUint8Array = await page.pdf({
                format: 'Letter',
                printBackground: true,
                margin: { top: '10mm', right: '10mm', bottom: '15mm', left: '10mm' }
            });
            return { buffer: Buffer.from(pdfUint8Array), data: dataReporte };
        } finally {
            await page.close();
        }
    }

    async evaluarPruebaPsicotecnica(intentoId: number, dto: EvaluatePsicotecnicaDto, user: any) {
        const db = this.supabase.getClient();

        const { data: intento } = await db.from('aspirantes_intentos_prueba')
            .select('*, aspirantes(*), aspirantes_pruebas(*)')
            .eq('id', intentoId)
            .single();

        if (!intento) throw new NotFoundException('Intento de prueba no encontrado');

        const esApto = dto.dictamen === DictamenPsicologico.APTO;
        const evaluadorNombre = user?.nombre_completo || user?.nombre || user?.email || 'Psicólogo(a) Evaluador(a)';

        let firmaUrl = dto.firma_base64 || user?.firma_digital_base64 || null;
        if (!firmaUrl && user?.id) {
            const { data: emp } = await db.from('empleados').select('firma_digital_base64').eq('usuario_id', user.id).maybeSingle();
            if (emp?.firma_digital_base64) firmaUrl = emp.firma_digital_base64;
        }

        const updates = {
            dictamen_psicologico: dto.dictamen,
            observaciones_evaluacion: dto.observaciones || '',
            evaluado_por_id: user?.id || null,
            evaluado_por_nombre: evaluadorNombre,
            evaluador_firma_url: firmaUrl,
            fecha_evaluacion: new Date(),
            aprobado: esApto
        };

        const { error: errUpdate } = await db.from('aspirantes_intentos_prueba').update(updates).eq('id', intentoId);
        if (errUpdate) throw new InternalServerErrorException(errUpdate.message);

        if (esApto) {
            await db.from('aspirantes').update({ estado: 'aprobado' }).eq('id', intento.aspirante_id);
        } else {
            await db.from('aspirantes').update({ estado: 'no_apto' }).eq('id', intento.aspirante_id);
        }

        // Generar/Actualizar PDF en bucket 'pruebas'
        try {
            const { buffer } = await this.generateTestReportPdfBuffer(intentoId);
            const adminSupabase = this.supabase.getSupabaseAdminClient();
            const fileName = `psicotecnica-${intento.aspirante_id}-${intentoId}.pdf`;
            await adminSupabase.storage.from('pruebas').upload(fileName, buffer, { contentType: 'application/pdf', upsert: true });
            const { data: urlData } = adminSupabase.storage.from('pruebas').getPublicUrl(fileName);
            if (urlData?.publicUrl) {
                await db.from('aspirantes_intentos_prueba').update({ pdf_prueba_url: urlData.publicUrl }).eq('id', intentoId);
            }
        } catch (e) {
            this.logger.error('Error actualizando PDF de psicotécnica en bucket pruebas:', e);
        }

        return {
            message: 'Evaluación psicotécnica registrada correctamente',
            dictamen: dto.dictamen,
            aprobado: esApto
        };
    }

    async hireAspirante(aspiranteId: number, usuarioAdminId: number) {
        const db = this.supabase.getClient();

        // 1. Obtener datos pre-empleado
        const { data: pre, error } = await db.from('aspirantes_datos_pre_empleado')
            .select('*')
            .eq('aspirante_id', aspiranteId)
            .eq('completado', true)
            .single();

        if (error || !pre) throw new BadRequestException('El aspirante no ha completado los datos pre-empleado o no existe');

        // 2. Generar el PDF SIG-GH-F-05 con Puppeteer
        const { buffer: pdfBuffer, data: pdfInfo } = await this.generateSeleccionPdfBuffer(aspiranteId);

        // 3. Subir el PDF SIG-GH-F-05 a Supabase Storage en el bucket EMPLEADOS / empleados
        const adminSupabase = this.supabase.getSupabaseAdminClient();
        const nombreCarpeta = pre.nombre_completo.trim().toUpperCase();
        const pathDocSeleccion = `${nombreCarpeta}/documentos-empresa/sig-gh-f-05-${pre.cedula}.pdf`;

        const uploadRes = await adminSupabase.storage.from('empleados').upload(pathDocSeleccion, pdfBuffer, {
            contentType: 'application/pdf',
            upsert: true
        });

        let documentoSeleccionUrl = '';
        if (!uploadRes.error) {
            const { data: urlData } = adminSupabase.storage.from('empleados').getPublicUrl(pathDocSeleccion);
            documentoSeleccionUrl = urlData?.publicUrl || '';
        }

        // 4. Calcular fechas de ingreso, examen médico y vacaciones
        const hoy = new Date();
        const fechaIngreso = hoy.toISOString().split('T')[0];
        const fechaExamenMedico = fechaIngreso;

        const proxVacacionesDate = new Date(hoy);
        proxVacacionesDate.setFullYear(proxVacacionesDate.getFullYear() + 1);
        const fechaProximasVacaciones = proxVacacionesDate.toISOString().split('T')[0];

        // 5. Obtener intentos presentados del aspirante para adjuntar únicamente PDFs de pruebas APROBADAS y APTAS
        const { data: intentosPruebas } = await db.from('aspirantes_intentos_prueba')
            .select('*, aspirantes_pruebas(tipo, nombre)')
            .eq('aspirante_id', aspiranteId)
            .eq('presentado', true)
            .order('id', { ascending: false }); // El más reciente primero

        let pruebaConocimientoUrl: string | null = null;
        let pruebaPsicotecnicaUrl: string | null = null;

        if (intentosPruebas && intentosPruebas.length > 0) {
            for (const item of intentosPruebas) {
                const tipoPrueba = item.aspirantes_pruebas?.tipo;
                const nombrePrueba = (item.aspirantes_pruebas?.nombre || '').toUpperCase();
                const esPsicotecnica = tipoPrueba === 'psicotecnica' || nombrePrueba.includes('BUSS') || nombrePrueba.includes('PSICO');

                // REGLA SOLICITADA: Solo se adjunta el PDF si la prueba técnica está APROBADA (aprobado === true) o la psicotécnica es APTO (dictamen === 'APTO')
                const esAprobadaOApta = esPsicotecnica
                    ? (item.dictamen_psicologico === 'APTO')
                    : (item.aprobado === true);

                if (esAprobadaOApta) {
                    let urlPdf = item.pdf_prueba_url;

                    // Si aún no se ha generado el PDF de este intento aprobado/apto, generarlo ahora
                    if (!urlPdf) {
                        try {
                            const { buffer: bufPdf } = await this.generateTestReportPdfBuffer(item.id);
                            const fileName = `reporte-prueba-${aspiranteId}-${item.id}.pdf`;
                            await adminSupabase.storage.from('pruebas').upload(fileName, bufPdf, { contentType: 'application/pdf', upsert: true });
                            const { data: urlData } = adminSupabase.storage.from('pruebas').getPublicUrl(fileName);
                            if (urlData?.publicUrl) {
                                urlPdf = urlData.publicUrl;
                                await db.from('aspirantes_intentos_prueba').update({ pdf_prueba_url: urlPdf }).eq('id', item.id);
                            }
                        } catch (e) {
                            this.logger.error(`Error generando PDF automático para intento ${item.id} en contratación:`, e);
                        }
                    }

                    if (urlPdf) {
                        if (esPsicotecnica && !pruebaPsicotecnicaUrl) {
                            pruebaPsicotecnicaUrl = urlPdf;
                        } else if (!esPsicotecnica && !pruebaConocimientoUrl) {
                            pruebaConocimientoUrl = urlPdf;
                        }
                    }
                }
            }
        }

        // 6. Verificar si el empleado ya existe en la base de datos por su cédula
        const { data: empExistente } = await db.from('empleados')
            .select('*')
            .eq('cedula', pre.cedula)
            .maybeSingle();

        if (empExistente) {
            // Si el empleado ya existe, no intentamos duplicarlo; sincronizamos sus carpetas de documentos
            const docCarpetasOriginal = empExistente.documentos_carpetas || {};
            const carpetasActualizadas = {
                ...docCarpetasOriginal,
                pruebas: {
                    ...(docCarpetasOriginal.pruebas || {}),
                    conocimiento: pruebaConocimientoUrl || docCarpetasOriginal.pruebas?.conocimiento || documentoSeleccionUrl,
                    psicotecnica: pruebaPsicotecnicaUrl || docCarpetasOriginal.pruebas?.psicotecnica
                },
                documentos_empresa: {
                    ...(docCarpetasOriginal.documentos_empresa || {}),
                    "sig-gh-f-05": documentoSeleccionUrl
                }
            };

            await db.from('empleados').update({
                documento_seleccion_url: documentoSeleccionUrl,
                documentos_carpetas: carpetasActualizadas,
                activo: true
            }).eq('id', empExistente.id);

            // Actualizar aspirante a contratado
            await db.from('aspirantes').update({
                estado: 'contratado',
                documento_seleccion_url: documentoSeleccionUrl
            }).eq('id', aspiranteId);

            return {
                message: 'Aspirante contratado exitosamente. El empleado ya existía con la misma cédula y sus documentos fueron actualizados en su hoja de vida.',
                empleado: empExistente,
                documento_seleccion_url: documentoSeleccionUrl
            };
        }

        // 7. Construir mapa de carpetas JSONB para el bucket EMPLEADOS/{NOMBRE COMPLETO}/
        const documentosCarpetas = {
            lista_chequeo: `${nombreCarpeta}/check-${pre.cedula}.pdf`,
            hoja_vida: pre.hoja_de_vida_url ? [`${nombreCarpeta}/hoja-vida/hv-${pre.cedula}.pdf`] : [],
            curso_vigilancia: pre.certificado_curso_url ? [`${nombreCarpeta}/curso-vigilancia/curso-${pre.cedula}.pdf`] : [],
            pruebas: {
                conocimiento: pruebaConocimientoUrl || documentoSeleccionUrl,
                psicotecnica: pruebaPsicotecnicaUrl,
                sustancias: null
            },
            afiliaciones: {
                eps: null,
                arl: null,
                afp: null,
                caja_compensacion: null
            },
            certificados: {
                bancario: pre.certificado_bancario_url || null,
                medico: pre.certificado_medico_url || null
            },
            documentos_empresa: {
                "sig-gh-f-05": documentoSeleccionUrl,
                "sig-gh-f-02": null,
                "sig-gh-f-06": null,
                "sig-gh-f-07": null,
                "sig-gh-f-08": null,
                "sig-gh-f-09": null,
                "sig-gh-f-10": null,
                "sig-gh-d-02": null,
                "sig-gh-l-01": null,
                "sig-gh-f-12": null,
                "sig-gh-f-15": null
            },
            documentos_varios: []
        };

        // 8. Crear Empleado (Mapeo completo con nuevos campos)
        const empleadoData = {
            nombre_completo: pre.nombre_completo,
            cedula: pre.cedula,
            fecha_expedicion: pre.fecha_expedicion,
            lugar_expedicion: pre.lugar_expedicion,
            fecha_nacimiento: pre.fecha_nacimiento,
            telefono: pre.telefono,
            telefono_2: pre.telefono_secundario,
            correo: pre.correo,
            direccion: pre.direccion,
            departamento: pre.departamento,
            ciudad: pre.ciudad,
            estado_civil: pre.estado_civil,
            genero: pre.genero,
            rh: pre.rh,
            eps_id: pre.eps_id,
            arl_id: pre.arl_id,
            fondo_pension_id: pre.fondo_pension_id,
            formacion_academica: pre.formacion_academica,
            tiene_discapacidad: pre.tiene_discapacidad,
            descripcion_discapacidad: pre.observacion_discapacidad,
            observaciones: pre.observaciones,
            creado_por: usuarioAdminId,
            activo: true,
            rol: 'empleado',
            fecha_ingreso: fechaIngreso,
            fecha_examen_medico: fechaExamenMedico,
            fecha_proximas_vacaciones: fechaProximasVacaciones,
            dias_vacaciones_disponibles: 0,
            documento_seleccion_url: documentoSeleccionUrl,
            documentos_carpetas: documentosCarpetas,
            hoja_de_vida_url: pre.hoja_de_vida_url || null,
            certificado_bancario_url: pre.certificado_bancario_url || null
        };

        const { data: nuevoEmpleado, error: errEmp } = await db.from('empleados').insert(empleadoData).select().single();
        if (errEmp) throw new InternalServerErrorException(`Error al crear empleado: ${errEmp.message}`);

        // 9. Actualizar estado del aspirante y guardar URL del documento
        await db.from('aspirantes').update({
            estado: 'contratado',
            documento_seleccion_url: documentoSeleccionUrl
        }).eq('id', aspiranteId);

        return {
            message: 'Aspirante contratado exitosamente',
            empleado: nuevoEmpleado,
            documento_seleccion_url: documentoSeleccionUrl
        };
    }

    // ==========================================
    // 7. NUEVOS ENDPOINTS REQUERIDOS
    // ==========================================

    // 1. Actualizar Prueba
    async updatePrueba(id: number, dto: any) {
        const db = this.supabase.getClient();
        const { data, error } = await db.from('aspirantes_pruebas').update(dto).eq('id', id).select().single();
        if (error) throw new InternalServerErrorException(error.message);
        return data;
    }

    // 2. Actualizar Pregunta
    async updatePregunta(id: number, dto: any) {
        const db = this.supabase.getClient();

        const updates: any = {};
        if (dto.pregunta) updates.pregunta = dto.pregunta;
        if (dto.retroalimentacion !== undefined) updates.retroalimentacion = dto.retroalimentacion;
        if (dto.orden !== undefined) updates.orden = dto.orden;

        // Actualizar pregunta
        const { data: pregunta, error } = await db.from('aspirantes_preguntas').update(updates).eq('id', id).select().single();
        if (error) throw new InternalServerErrorException(error.message);

        // Si hay opciones para actualizar
        if (dto.opciones) {
            // 1. Obtener opciones actuales de la base de datos para esta pregunta
            const { data: currentDbOptions, error: fetchErr } = await db
                .from('aspirantes_preguntas_opciones')
                .select('id')
                .eq('pregunta_id', id);
            
            if (fetchErr) throw new InternalServerErrorException(fetchErr.message);

            const dbOptionIds = (currentDbOptions || []).map(o => o.id);
            const inputOptionIds = dto.opciones.filter((op: any) => op.id).map((op: any) => op.id);

            // Determinar cuáles eliminar (existen en DB pero no en el input)
            const idsToDelete = dbOptionIds.filter(dbId => !inputOptionIds.includes(dbId));

            if (idsToDelete.length > 0) {
                const { error: deleteErr } = await db
                    .from('aspirantes_preguntas_opciones')
                    .delete()
                    .in('id', idsToDelete);
                if (deleteErr) {
                    if (deleteErr.code === '23503') {
                        throw new BadRequestException('No se pueden eliminar opciones de respuesta que ya han sido seleccionadas por candidatos en sus intentos.');
                    }
                    throw new InternalServerErrorException(deleteErr.message);
                }
            }

            // Procesar actualizaciones e inserciones
            for (const op of dto.opciones) {
                if (op.id && dbOptionIds.includes(op.id)) {
                    // Actualizar opción existente
                    const { error: updateErr } = await db
                        .from('aspirantes_preguntas_opciones')
                        .update({
                            texto: op.texto,
                            es_correcta: op.es_correcta,
                            orden: op.orden
                        })
                        .eq('id', op.id);
                    if (updateErr) throw new InternalServerErrorException(updateErr.message);
                } else {
                    // Insertar nueva opción
                    const { error: insertErr } = await db
                        .from('aspirantes_preguntas_opciones')
                        .insert({
                            pregunta_id: id,
                            texto: op.texto,
                            es_correcta: op.es_correcta,
                            orden: op.orden
                        });
                    if (insertErr) throw new InternalServerErrorException(insertErr.message);
                }
            }
        }

        return pregunta;
    }

    // 3. Listar Preguntas de una Prueba
    async getPreguntasByPrueba(pruebaId: number) {
        const db = this.supabase.getClient();
        const { data, error } = await db
            .from('aspirantes_preguntas')
            .select('*, opciones:aspirantes_preguntas_opciones(*)')
            .eq('prueba_id', pruebaId)
            .order('orden', { ascending: true });

        if (error) throw new InternalServerErrorException(error.message);
        return data;
    }

    // 4. Listar Intentos con Filtros
    async findAllIntentos(filters?: { aspirante_id?: number; prueba_id?: number; presentado?: boolean; fecha?: string }) {
        const db = this.supabase.getClient();
        let query = db.from('aspirantes_intentos_prueba')
            .select('*, aspirantes(nombre_completo, cedula), aspirantes_pruebas(nombre)')
            .order('created_at', { ascending: false });

        if (filters?.aspirante_id) query = query.eq('aspirante_id', filters.aspirante_id);
        if (filters?.prueba_id) query = query.eq('prueba_id', filters.prueba_id);
        if (filters?.presentado !== undefined) query = query.eq('presentado', filters.presentado);
        if (filters?.fecha) query = query.eq('fecha_programada', filters.fecha);

        const { data, error } = await query;
        if (error) throw new InternalServerErrorException(error.message);
        return data;
    }

    // 5. Historial de Intentos por Aspirante
    async getIntentosByAspirante(aspiranteId: number) {
        const db = this.supabase.getClient();
        const { data, error } = await db
            .from('aspirantes_intentos_prueba')
            .select('*, aspirantes_pruebas(nombre)')
            .eq('aspirante_id', aspiranteId)
            .order('created_at', { ascending: false });

        if (error) throw new InternalServerErrorException(error.message);
        return data;
    }

    // 6. Cambiar Estado del Aspirante
    async updateEstadoAspirante(id: number, estado: string, observacion?: string) {
        const db = this.supabase.getClient();
        const { data, error } = await db
            .from('aspirantes')
            .update({ estado, updated_at: new Date() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw new InternalServerErrorException(error.message);

        // Opcionalmente registrar en auditoria la observación
        this.logger.log(`Estado del aspirante ${id} cambiado a: ${estado}. ${observacion || ''}`);

        return data;
    }

    // 7. Reenviar Link
    async resendLink(id: number, regenerateToken: boolean = false) {
        const db = this.supabase.getClient();

        if (regenerateToken) {
            // Generar nuevo token
            await db.from('aspirantes_intentos_prueba').update({
                token: null // Esto hará que se regenere automáticamente si hay un trigger, sino necesitamos gen_random_uuid()
            }).eq('id', id);
        }

        // Retornar el link actualizado
        return await this.generateShareLink(id);
    }

    // 8. Estado Público (sin respuestas)
    async getPublicStatus(token: string) {
        const db = this.supabase.getClient();
        const { data: intento, error } = await db
            .from('aspirantes_intentos_prueba')
            .select('presentado, aprobado, porcentaje, fecha_programada, hora_inicio, hora_fin, fecha_inicio_real, fecha_fin_real, aspirantes_pruebas(tiempo_minutos)')
            .eq('token', token)
            .single();

        if (error || !intento) throw new NotFoundException('Token no válido');

        // Calcular tiempo restante si está en progreso
        let tiempoRestante: number | null = null;
        if (intento.fecha_inicio_real && !intento.presentado) {
            const tiempoLimite = (intento.aspirantes_pruebas as any)?.tiempo_minutos || 60;
            const inicioReal = new Date(intento.fecha_inicio_real);
            const ahora = new Date();
            const transcurrido = Math.floor((ahora.getTime() - inicioReal.getTime()) / 60000); // minutos
            tiempoRestante = Math.max(0, tiempoLimite - transcurrido);
        }

        return {
            estado: intento.presentado ? 'finalizado' : (intento.fecha_inicio_real ? 'en_progreso' : 'pendiente'),
            aprobado: intento.aprobado,
            porcentaje: intento.porcentaje,
            tiempo_restante_minutos: tiempoRestante,
            fecha_programada: intento.fecha_programada,
            hora_inicio: intento.hora_inicio,
            hora_fin: intento.hora_fin
        };
    }

    // 9. Cancelar Prueba en Ejecución
    async cancelarIntento(id: number, motivo: string) {
        const db = this.supabase.getClient();

        // Marcar como cancelado sin borrar respuestas
        const { data, error } = await db.from('aspirantes_intentos_prueba').update({
            presentado: true,
            aprobado: false,
            fecha_fin_real: new Date(),
            // Guardar motivo en un campo de observaciones si existe, o en porcentaje null para diferenciarlo
            porcentaje: null // Null indica cancelado vs 0 reprobado
        }).eq('id', id).select().single();

        if (error) throw new InternalServerErrorException(error.message);

        // Log del motivo
        this.logger.warn(`Intento ${id} cancelado. Motivo: ${motivo}`);

        return {
            message: 'Prueba cancelada exitosamente',
            motivo,
            data
        };
    }

    // Utilidad Haversine
    private calcularDistancia(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371e3; // Radio tierra metros
        const phi1 = lat1 * Math.PI / 180;
        const phi2 = lat2 * Math.PI / 180;
        const deltaPhi = (lat2 - lat1) * Math.PI / 180;
        const deltaLambda = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c; // en metros
    }
}
