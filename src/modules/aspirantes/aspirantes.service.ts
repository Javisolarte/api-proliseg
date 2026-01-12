import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreatePruebaDto } from './dto/create-prueba.dto';
import { CreatePreguntaDto } from './dto/create-pregunta.dto';
import { CreateAspiranteDto } from './dto/create-aspirante.dto';
import { ProgramarIntentoDto, ReprogramarIntentoDto } from './dto/programar-intento.dto';
import { SubmitRespuestaDto } from './dto/submit-respuesta.dto';
import { SaveDatosPreEmpleadoDto } from './dto/save-datos-pre-empleado.dto';

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
        const { data, error } = await db.from('aspirantes').select('*').order('created_at', { ascending: false });
        if (error) throw new InternalServerErrorException(error.message);
        return data;
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

        // 2. Validar Fecha
        const hoy = new Date().toISOString().split('T')[0];
        if (intento.fecha_programada !== hoy) {
            throw new BadRequestException(`La prueba está programada para el ${intento.fecha_programada}. Hoy es ${hoy}.`);
        }

        // 3. Validar Hora
        const ahora = new Date();
        const horaActual = ahora.toTimeString().split(' ')[0]; // HH:MM:SS
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
            .select('*, aspirantes_pruebas(puntaje_minimo)')
            .eq('token', token)
            .single();

        if (!intento) throw new NotFoundException('Intento no encontrado');

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

        const porcentaje = total > 0 ? (correctas / total) * 100 : 0;
        // Accessing nested property safely although typeorm/supabase joins usually return object
        const minScore = (intento.aspirantes_pruebas as any)?.puntaje_minimo || 70;
        const aprobado = porcentaje >= minScore;

        // Actualizar intento
        await db.from('aspirantes_intentos_prueba').update({
            fecha_fin_real: new Date(),
            presentado: true,
            porcentaje: porcentaje,
            aprobado: aprobado
        }).eq('id', intento.id);

        // Actualizar estado aspirante si aprobó
        if (aprobado) {
            await db.from('aspirantes').update({ estado: 'aprobado' }).eq('id', intento.aspirante_id);
        } // Si reprueba, se queda en 'en_proceso' o lo que tenía.

        return {
            message: 'Prueba finalizada',
            resultado: {
                porcentaje,
                aprobado,
                totalPreguntas: total,
                respuestasCorrectas: correctas
            }
        };
    }

    async getResults(token: string) {
        const db = this.supabase.getClient();
        const { data: intento } = await db.from('aspirantes_intentos_prueba').select('*').eq('token', token).single();
        if (!intento || !intento.presentado) throw new BadRequestException('Prueba no finalizada o no encontrada');

        // Obtener retroalimentación de las incorrectas
        // 1. Obtener todas las preguntas de la prueba
        const { data: preguntas } = await db.from('aspirantes_preguntas')
            .select('id, pregunta, retroalimentacion')
            .eq('prueba_id', intento.prueba_id);

        // 2. Obtener respuestas del usuario
        const { data: respuestas } = await db.from('aspirantes_respuestas')
            .select('pregunta_id, es_correcta, opcion_id')
            .eq('intento_id', intento.id);

        // Cruzar info
        const detalle = (preguntas || []).map(p => {
            const resp = (respuestas || []).find(r => r.pregunta_id === p.id);
            const fueCorrecta = resp?.es_correcta || false;
            return {
                pregunta: p.pregunta,
                correcta: fueCorrecta,
                retroalimentacion: fueCorrecta ? null : p.retroalimentacion // Solo mostrar retro si falló
            };
        });

        return {
            aprobado: intento.aprobado,
            porcentaje: intento.porcentaje,
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

    async hireAspirante(aspiranteId: number, usuarioAdminId: number) {
        const db = this.supabase.getClient();

        // 1. Obtener datos pre-empleado
        const { data: pre, error } = await db.from('aspirantes_datos_pre_empleado')
            .select('*')
            .eq('aspirante_id', aspiranteId)
            .eq('completado', true)
            .single();

        if (error || !pre) throw new BadRequestException('El aspirante no ha completado los datos pre-empleado o no existe');

        // 2. Crear Empleado (Mapeo de campos)
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
            rol: 'empleado'
        };

        const { data: nuevoEmpleado, error: errEmp } = await db.from('empleados').insert(empleadoData).select().single();
        if (errEmp) throw new InternalServerErrorException(`Error al crear empleado: ${errEmp.message}`);

        // 3. Actualizar estado aspirante
        await db.from('aspirantes').update({ estado: 'contratado' }).eq('id', aspiranteId);

        return { message: 'Aspirante contratado exitosamente', empleado: nuevoEmpleado };
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
        if (dto.opciones && dto.opciones.length > 0) {
            // Eliminar opciones existentes y crear nuevas (más simple que update individual)
            await db.from('aspirantes_preguntas_opciones').delete().eq('pregunta_id', id);

            const opcionesToInsert = dto.opciones.map((op: any) => ({
                pregunta_id: id,
                texto: op.texto,
                es_correcta: op.es_correcta,
                orden: op.orden
            }));

            await db.from('aspirantes_preguntas_opciones').insert(opcionesToInsert);
        }

        return pregunta;
    }

    // 3. Listar Preguntas de una Prueba
    async getPreguntasByPrueba(pruebaId: number) {
        const db = this.supabase.getClient();
        const { data, error } = await db
            .from('aspirantes_preguntas')
            .select('*, aspirantes_preguntas_opciones(*)')
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
