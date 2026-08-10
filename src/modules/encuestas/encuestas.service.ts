import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateEncuestaDto, UpdateEncuestaDto, SubmitRespuestaDto } from './dto/encuesta.dto';
import * as crypto from 'crypto';

@Injectable()
export class EncuestasService {
  private readonly logger = new Logger(EncuestasService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  // Helper para ejecutar SQL con Supabase RPC
  private async execSql(query: string, params: any[] = []) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase.rpc('exec_sql', { query });
    if (error) {
      this.logger.error(`Error en execSql: ${error.message} (${error.details}) | SQL: ${query.substring(0, 200)}`);
      throw new BadRequestException(`Error de base de datos: ${error.message}`);
    }
    return Array.isArray(data) ? data : [];
  }

  private generateToken(): string {
    return 'ENC-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  }

  // 🔹 LISTAR TODAS LAS ENCUESTAS CON ESTADÍSTICAS
  async findAll(filters?: { tipo?: string; estado?: string }) {
    try {
      let sql = `
        SELECT e.*,
               COALESCE(e.creado_por_nombre, 'Administrador SGG') as creado_por_nombre,
               COUNT(DISTINCT r.id)::int as total_respuestas,
               COALESCE(ROUND(AVG(r.porcentaje_favorabilidad), 1), 0)::float as favorabilidad_promedio,
               COALESCE(ROUND(AVG(r.puntaje_total), 1), 0)::float as puntaje_promedio,
               COUNT(DISTINCT p.id)::int as cantidad_preguntas
        FROM encuestas e
        LEFT JOIN encuesta_respuestas r ON e.id = r.encuesta_id AND r.completada = true
        LEFT JOIN encuesta_preguntas p ON e.id = p.encuesta_id
        WHERE 1=1
      `;

      if (filters?.tipo) {
        sql += ` AND e.tipo = '${filters.tipo}'`;
      }
      if (filters?.estado) {
        sql += ` AND e.estado = '${filters.estado}'`;
      }

      sql += ` GROUP BY e.id ORDER BY e.created_at DESC`;

      const rows = await this.execSql(sql);
      return rows;
    } catch (error) {
      this.logger.error('Error en findAll encuestas:', error);
      throw error;
    }
  }

  // 🔹 OBTENER ENCUESTA INDIVIDUAL CON SUS PREGUNTAS
  async findOne(id: number) {
    try {
      const supabase = this.supabaseService.getSupabaseAdminClient();
      const { data: encuesta, error } = await supabase
        .from('encuestas')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !encuesta) {
        throw new NotFoundException(`Encuesta con ID ${id} no encontrada`);
      }

      const { data: preguntas } = await supabase
        .from('encuesta_preguntas')
        .select('*')
        .eq('encuesta_id', id)
        .order('orden', { ascending: true })
        .order('id', { ascending: true });

      encuesta.preguntas = preguntas || [];
      return encuesta;
    } catch (error) {
      this.logger.error(`Error al buscar encuesta ${id}:`, error);
      throw error;
    }
  }

  // 🔹 OBTENER ENCUESTA PÚBLICA POR TOKEN (SIN AUTH)
  async findByToken(token: string) {
    try {
      const supabase = this.supabaseService.getSupabaseAdminClient();
      const { data: encuesta, error } = await supabase
        .from('encuestas')
        .select('*')
        .eq('token_publico', token)
        .single();

      if (error || !encuesta) {
        throw new NotFoundException('Encuesta no encontrada o el enlace no es válido.');
      }

      const { data: preguntas } = await supabase
        .from('encuesta_preguntas')
        .select('id, orden, dimension, texto_pregunta, tipo_pregunta, opciones, puntos, es_requerida')
        .eq('encuesta_id', encuesta.id)
        .order('orden', { ascending: true })
        .order('id', { ascending: true });

      encuesta.preguntas = preguntas || [];
      return encuesta;
    } catch (error) {
      this.logger.error(`Error al buscar encuesta pública por token ${token}:`, error);
      throw error;
    }
  }

  // 🔹 CREAR NUEVA ENCUESTA
  async create(createDto: CreateEncuestaDto, usuarioId?: number) {
    try {
      const supabase = this.supabaseService.getSupabaseAdminClient();
      const token = this.generateToken();

      const tipoVigencia = createDto.tipo_vigencia || 'indefinido';
      const horasVigencia = createDto.horas_vigencia || 24;
      let fechaCierre: string | null = null;

      if (tipoVigencia === 'horas') {
        const d = new Date();
        d.setHours(d.getHours() + horasVigencia);
        fechaCierre = d.toISOString();
      } else if (tipoVigencia === 'fecha_especifica' && createDto.fecha_cierre) {
        fechaCierre = new Date(createDto.fecha_cierre).toISOString();
      }

      const payloadEncuesta: any = {
        titulo: createDto.titulo,
        descripcion: createDto.descripcion || '',
        tipo: createDto.tipo || 'clima_laboral',
        token_publico: token,
        estado: createDto.estado || 'activa',
        permite_respuestas_anonimas: createDto.permite_respuestas_anonimas !== false,
        requiere_identificacion: createDto.requiere_identificacion === true,
        mostrar_aviso_privacidad: createDto.mostrar_aviso_privacidad !== false,
        instrucciones: createDto.instrucciones || '',
        aviso_privacidad: createDto.aviso_privacidad || '',
        tipo_vigencia: tipoVigencia,
        horas_vigencia: tipoVigencia === 'horas' ? horasVigencia : null,
        fecha_cierre: fechaCierre,
        creado_por: usuarioId || null
      };

      const { data: nuevaEncuesta, error } = await supabase
        .from('encuestas')
        .insert(payloadEncuesta)
        .select()
        .single();

      if (error) {
        this.logger.error('Error insertando encuesta en Supabase:', error);
        throw new BadRequestException(`Error de base de datos: ${error.message}`);
      }

      if (createDto.preguntas && createDto.preguntas.length > 0) {
        await this.insertOrUpdatePreguntas(nuevaEncuesta.id, createDto.preguntas);
      }

      return this.findOne(nuevaEncuesta.id);
    } catch (error) {
      this.logger.error('Error creando encuesta:', error);
      throw error;
    }
  }

  // 🔹 ACTUALIZAR ENCUESTA
  async update(id: number, updateDto: UpdateEncuestaDto) {
    try {
      const supabase = this.supabaseService.getSupabaseAdminClient();
      const existente = await this.findOne(id);
      if (!existente) throw new NotFoundException('Encuesta no encontrada');

      const tipoVigencia = updateDto.tipo_vigencia || existente.tipo_vigencia || 'indefinido';
      const horasVigencia = updateDto.horas_vigencia || existente.horas_vigencia || 24;
      let fechaCierre: string | null = null;

      if (tipoVigencia === 'horas') {
        const d = new Date();
        d.setHours(d.getHours() + horasVigencia);
        fechaCierre = d.toISOString();
      } else if (tipoVigencia === 'fecha_especifica' && updateDto.fecha_cierre) {
        fechaCierre = new Date(updateDto.fecha_cierre).toISOString();
      } else if (tipoVigencia === 'indefinido') {
        fechaCierre = null;
      } else if (existente.fecha_cierre) {
        fechaCierre = new Date(existente.fecha_cierre).toISOString();
      }

      const payloadUpdate: any = {
        titulo: updateDto.titulo !== undefined ? updateDto.titulo : existente.titulo,
        descripcion: updateDto.descripcion !== undefined ? updateDto.descripcion : existente.descripcion,
        tipo: updateDto.tipo !== undefined ? updateDto.tipo : existente.tipo,
        estado: updateDto.estado !== undefined ? updateDto.estado : existente.estado,
        permite_respuestas_anonimas: updateDto.permite_respuestas_anonimas !== undefined ? updateDto.permite_respuestas_anonimas : existente.permite_respuestas_anonimas,
        requiere_identificacion: updateDto.requiere_identificacion !== undefined ? updateDto.requiere_identificacion : existente.requiere_identificacion,
        mostrar_aviso_privacidad: updateDto.mostrar_aviso_privacidad !== undefined ? updateDto.mostrar_aviso_privacidad : existente.mostrar_aviso_privacidad,
        instrucciones: updateDto.instrucciones !== undefined ? updateDto.instrucciones : existente.instrucciones,
        aviso_privacidad: updateDto.aviso_privacidad !== undefined ? updateDto.aviso_privacidad : existente.aviso_privacidad,
        tipo_vigencia: tipoVigencia,
        horas_vigencia: tipoVigencia === 'horas' ? horasVigencia : null,
        fecha_cierre: fechaCierre,
        updated_at: new Date().toISOString()
      };

      const { error: errUpdate } = await supabase
        .from('encuestas')
        .update(payloadUpdate)
        .eq('id', id);

      if (errUpdate) {
        this.logger.error(`Error actualizando encuesta ${id}:`, errUpdate);
        throw new BadRequestException(`Error actualizando encuesta: ${errUpdate.message}`);
      }

      if (updateDto.preguntas) {
        await supabase.from('encuesta_preguntas').delete().eq('encuesta_id', id);
        await this.insertOrUpdatePreguntas(id, updateDto.preguntas);
      }

      return this.findOne(id);
    } catch (error) {
      this.logger.error(`Error actualizando encuesta ${id}:`, error);
      throw error;
    }
  }

  // Helper para insertar preguntas
  private async insertOrUpdatePreguntas(encuestaId: number, preguntas: any[]) {
    const supabase = this.supabaseService.getSupabaseAdminClient();
    let ordenCount = 1;
    const rowsToInsert = preguntas.map(p => ({
      encuesta_id: encuestaId,
      orden: p.orden || ordenCount++,
      dimension: p.dimension || '',
      texto_pregunta: p.texto_pregunta || '',
      tipo_pregunta: p.tipo_pregunta || 'likert_5',
      opciones: p.opciones || [],
      respuesta_correcta: p.respuesta_correcta !== undefined ? p.respuesta_correcta : null,
      puntos: p.puntos || 1,
      es_requerida: p.es_requerida !== false
    }));

    const { error } = await supabase.from('encuesta_preguntas').insert(rowsToInsert);
    if (error) {
      this.logger.error('Error insertando preguntas de encuesta:', error);
      throw new BadRequestException(`Error insertando preguntas: ${error.message}`);
    }
  }

  // 🔹 ELIMINAR ENCUESTA
  async remove(id: number) {
    try {
      const supabase = this.supabaseService.getSupabaseAdminClient();
      const { error } = await supabase.from('encuestas').delete().eq('id', id);
      if (error) {
        this.logger.error(`Error eliminando encuesta ${id}:`, error);
        throw new BadRequestException(`Error eliminando encuesta: ${error.message}`);
      }
      return { success: true, message: `Encuesta ${id} eliminada correctamente` };
    } catch (error) {
      this.logger.error(`Error al eliminar encuesta ${id}:`, error);
      throw error;
    }
  }

  // 🔹 REGISTRAR RESPUESTA PÚBLICA DE ENCUESTA
  async submitRespuesta(token: string, dto: SubmitRespuestaDto) {
    try {
      const supabase = this.supabaseService.getSupabaseAdminClient();
      if (!dto.acepta_tratamiento_datos) {
        throw new BadRequestException('Es obligatorio aceptar la Autorización de Tratamiento de Datos Personales para enviar la encuesta.');
      }

      const encuesta = await this.findByToken(token);
      if (!encuesta) throw new NotFoundException('Encuesta no encontrada');

      const preguntas = encuesta.preguntas || [];
      const mapaPreguntas = new Map<number, any>();
      preguntas.forEach((p: any) => mapaPreguntas.set(p.id, p));

      let totalPuntaje = 0;
      let maximoPuntajePosible = 0;
      let respuestasDetalle: any[] = [];

      for (const r of dto.respuestas) {
        const p = mapaPreguntas.get(r.pregunta_id);
        if (!p) continue;

        let puntajeObtenido = 0;
        let esCorrecta: boolean | null = null;
        const valStr = (r.valor_respuesta !== null && r.valor_respuesta !== undefined) ? String(r.valor_respuesta) : '';

        // Si es escala Likert (1 a 5)
        if (p.tipo_pregunta === 'likert_5') {
          const match = valStr ? valStr.match(/^(\d)/) : null;
          const numVal = match ? parseInt(match[1], 10) : parseInt(valStr, 10) || 0;
          puntajeObtenido = numVal;
          maximoPuntajePosible += 5;
        } else if (p.respuesta_correcta !== null && p.respuesta_correcta !== undefined) {
          const respCorrStr = typeof p.respuesta_correcta === 'string' ? p.respuesta_correcta : JSON.stringify(p.respuesta_correcta);
          esCorrecta = valStr.trim().toLowerCase() === respCorrStr.trim().toLowerCase();
          puntajeObtenido = esCorrecta ? (p.puntos || 1) : 0;
          maximoPuntajePosible += (p.puntos || 1);
        } else {
          maximoPuntajePosible += (p.puntos || 1);
        }

        totalPuntaje += puntajeObtenido;
        respuestasDetalle.push({
          pregunta_id: p.id,
          valor_respuesta: r.valor_respuesta,
          puntaje_obtenido: puntajeObtenido,
          es_correcta: esCorrecta
        });
      }

      const pctFavorabilidad = maximoPuntajePosible > 0 ? (totalPuntaje / maximoPuntajePosible) * 100 : 0;
      let nivelResultado = 'promedio';
      if (pctFavorabilidad >= 85) nivelResultado = 'alto';
      else if (pctFavorabilidad < 70) nivelResultado = 'bajo';

      const payloadRespuesta: any = {
        encuesta_id: encuesta.id,
        token_publico: token,
        nombre_respondiente: dto.nombre_respondiente || '',
        documento_respondiente: dto.documento_respondiente || '',
        cargo_respondiente: dto.cargo_respondiente || '',
        sede_area: dto.sede_area || '',
        acepta_tratamiento_datos: true,
        puntaje_total: totalPuntaje,
        porcentaje_favorabilidad: parseFloat(pctFavorabilidad.toFixed(2)),
        nivel_resultado: nivelResultado,
        completada: true,
        duracion_segundos: dto.duracion_segundos || 0,
        latitud: dto.latitud !== undefined && dto.latitud !== null && !isNaN(dto.latitud) ? dto.latitud : null,
        longitud: dto.longitud !== undefined && dto.longitud !== null && !isNaN(dto.longitud) ? dto.longitud : null,
        ubicacion_ciudad: dto.ubicacion_ciudad || ''
      };

      const { data: resRespuesta, error: errResp } = await supabase
        .from('encuesta_respuestas')
        .insert(payloadRespuesta)
        .select('id')
        .single();

      if (errResp) {
        this.logger.error('Error insertando respuesta de encuesta:', errResp);
        throw new BadRequestException(`Error registrando respuesta: ${errResp.message}`);
      }

      const respuestaId = resRespuesta.id;

      // Insertar detalles
      if (respuestasDetalle.length > 0) {
        const rowsDetalle = respuestasDetalle.map(d => ({
          respuesta_id: respuestaId,
          pregunta_id: d.pregunta_id,
          valor_respuesta: d.valor_respuesta,
          puntaje_obtenido: d.puntaje_obtenido,
          es_correcta: d.es_correcta
        }));
        const { error: errDet } = await supabase.from('encuesta_respuesta_detalles').insert(rowsDetalle);
        if (errDet) {
          this.logger.error('Error insertando detalles de respuesta:', errDet);
        }
      }

      return {
        success: true,
        message: '¡Encuesta registrada exitosamente! Muchas gracias por su valiosa participación.',
        respuesta_id: respuestaId,
        puntaje_total: totalPuntaje,
        porcentaje_favorabilidad: parseFloat(pctFavorabilidad.toFixed(1)),
        nivel_resultado: nivelResultado
      };
    } catch (error) {
      this.logger.error('Error registrando respuesta pública:', error);
      throw error;
    }
  }

  // 🔹 INFORME / REPORTE COMPLETO DE RESULTADOS DE ENCUESTA
  async getReporte(id: number) {
    try {
      const encuesta = await this.findOne(id);
      if (!encuesta) throw new NotFoundException('Encuesta no encontrada');

      const sqlResumen = `
        SELECT 
          COUNT(id)::int as total_respuestas,
          COALESCE(ROUND(AVG(porcentaje_favorabilidad), 1), 0)::float as favorabilidad_general,
          COALESCE(ROUND(AVG(puntaje_total), 1), 0)::float as puntaje_promedio,
          COUNT(CASE WHEN nivel_resultado = 'alto' THEN 1 END)::int as conteo_alto,
          COUNT(CASE WHEN nivel_resultado = 'promedio' THEN 1 END)::int as conteo_promedio,
          COUNT(CASE WHEN nivel_resultado = 'bajo' THEN 1 END)::int as conteo_bajo
        FROM encuesta_respuestas
        WHERE encuesta_id = ${id} AND completada = true
      `;
      const resResumen = await this.execSql(sqlResumen);
      const resumen = resResumen[0] || {
        total_respuestas: 0,
        favorabilidad_general: 0,
        puntaje_promedio: 0,
        conteo_alto: 0,
        conteo_promedio: 0,
        conteo_bajo: 0
      };

      // Si es de Clima Laboral, desglose por Dimensiones
      let dimensionesReporte: any[] = [];
      const sqlDimensiones = `
        SELECT 
          p.dimension,
          COUNT(d.id)::int as total_respuestas_preguntas,
          ROUND(AVG(d.puntaje_obtenido), 2)::float as promedio_puntaje,
          ROUND((AVG(d.puntaje_obtenido) / 5.0) * 100, 1)::float as favorabilidad_pct
        FROM encuesta_respuesta_detalles d
        JOIN encuesta_preguntas p ON d.pregunta_id = p.id
        JOIN encuesta_respuestas r ON d.respuesta_id = r.id
        WHERE p.encuesta_id = ${id} AND r.completada = true AND p.dimension IS NOT NULL AND p.dimension != ''
        GROUP BY p.dimension
        ORDER BY p.dimension ASC
      `;
      const resDimensiones = await this.execSql(sqlDimensiones);

      // Generar recomendaciones de plan de acción para cada dimensión basándose en el instructivo SIG-GH-I-04
      const recomendacionesMap: Record<string, { bajo: string; promedio: string; alto: string }> = {
        'Relaciones interpersonales': {
          bajo: 'Realizar jornadas de mediación y resolución de conflictos entre equipos con apoyo de Talento Humano o Comité de Convivencia Laboral.',
          promedio: 'Capacitar a los colaboradores en comunicación asertiva, manejo de conflictos y trabajo en equipo.',
          alto: 'Desarrollar actividades de integración, reconocimiento grupal y fortalecimiento del compañerismo.'
        },
        'Estilo de dirección': {
          bajo: 'Implementar procesos de coaching o acompañamiento para líderes que presenten dificultades en la gestión de personas.',
          promedio: 'Capacitar a los líderes en liderazgo participativo, inteligencia emocional y retroalimentación efectiva.',
          alto: 'Crear una escuela de liderazgo con espacios periódicos de intercambio de buenas prácticas.'
        },
        'Sentido de pertenencia': {
          bajo: 'Realizar grupos focales para identificar factores que afectan el compromiso y definir acciones de mejora.',
          promedio: 'Implementar un plan de inducción y reinducción que fortalezca el conocimiento de la misión, visión y objetivos institucionales.',
          alto: 'Desarrollar campañas de reconocimiento a la trayectoria, logros y contribuciones de los colaboradores.'
        },
        'Retribución': {
          bajo: 'Revisar los mecanismos de reconocimiento e incentivos con participación de los trabajadores para identificar oportunidades de mejora.',
          promedio: 'Socializar de manera transparente los criterios de compensación, incentivos y reconocimientos existentes.',
          alto: 'Implementar un programa de reconocimiento no monetario (empleado destacado, agradecimientos públicos).'
        },
        'Disponibilidad de recursos': {
          bajo: 'Identificar las necesidades de herramientas, equipos e insumos mediante mesas de trabajo y ejecutar un plan de mejora.',
          promedio: 'Establecer un cronograma periódico de mantenimiento preventivo y verificación de recursos de trabajo.',
          alto: 'Implementar un canal permanente para reportar necesidades y propuestas de mejora relacionadas con los recursos laborales.'
        },
        'Estabilidad': {
          bajo: 'Realizar entrevistas de permanencia para identificar factores que generan incertidumbre laboral y establecer acciones correctivas.',
          promedio: 'Informar oportunamente los cambios organizacionales y las decisiones que impacten a los colaboradores.',
          alto: 'Diseñar planes de desarrollo y crecimiento profesional que fortalezcan la percepción de estabilidad.'
        },
        'Claridad y coherencia en la dirección': {
          bajo: 'Revisar y actualizar funciones, responsabilidades y procesos cuando se identifiquen inconsistencias organizacionales.',
          promedio: 'Realizar reuniones periódicas de seguimiento donde los líderes comuniquen objetivos, metas y avances institucionales.',
          alto: 'Fortalecer la comunicación organizacional mediante boletines, espacios de diálogo y rendición de resultados.'
        },
        'Valores colectivos': {
          bajo: 'Desarrollar talleres vivenciales para fortalecer el respeto, la ética y la convivencia cuando se identifiquen comportamientos desalineados.',
          promedio: 'Sensibilizar periódicamente sobre el Código de Ética, normas de convivencia y cultura organizacional.',
          alto: 'Implementar campañas institucionales que promuevan valores como respeto, compromiso, solidaridad y trabajo colaborativo.'
        }
      };

      dimensionesReporte = resDimensiones.map((d: any) => {
        let nivel = 'promedio';
        if (d.favorabilidad_pct >= 85) nivel = 'alto';
        else if (d.favorabilidad_pct < 70) nivel = 'bajo';

        const recs = recomendacionesMap[d.dimension] || {
          bajo: 'Implementar plan de intervención correctiva inmediata.',
          promedio: 'Realizar actividades de prevención y fortalecimiento.',
          alto: 'Promover y mantener las buenas prácticas organizacionales.'
        };

        return {
          dimension: d.dimension,
          favorabilidad_pct: d.favorabilidad_pct,
          promedio_puntaje: d.promedio_puntaje,
          nivel: nivel,
          actividad_plan_accion: recs[nivel as keyof typeof recs]
        };
      });

      // Detalle de respuestas recientes con las respuestas a cada pregunta
      const sqlRespuestasRecientes = `
        SELECT r.id, r.nombre_respondiente, r.documento_respondiente, r.cargo_respondiente, r.sede_area,
               r.latitud, r.longitud, r.ubicacion_ciudad,
               r.puntaje_total, r.porcentaje_favorabilidad, r.nivel_resultado, r.created_at,
               COALESCE(
                 JSON_AGG(
                   JSON_BUILD_OBJECT(
                     'pregunta_id', d.pregunta_id,
                     'texto_pregunta', p.texto_pregunta,
                     'tipo_pregunta', p.tipo_pregunta,
                     'valor_respuesta', d.valor_respuesta,
                     'puntaje_obtenido', d.puntaje_obtenido,
                     'es_correcta', d.es_correcta,
                     'respuesta_correcta', p.respuesta_correcta
                   ) ORDER BY p.orden ASC, p.id ASC
                 ) FILTER (WHERE d.id IS NOT NULL), '[]'::json
               ) as detalles
        FROM encuesta_respuestas r
        LEFT JOIN encuesta_respuesta_detalles d ON r.id = d.respuesta_id
        LEFT JOIN encuesta_preguntas p ON d.pregunta_id = p.id
        WHERE r.encuesta_id = ${id} AND r.completada = true
        GROUP BY r.id
        ORDER BY r.created_at DESC
        LIMIT 50
      `;
      const respuestasRecientes = await this.execSql(sqlRespuestasRecientes);

      return {
        encuesta,
        resumen,
        dimensiones: dimensionesReporte,
        respuestas_recientes: respuestasRecientes
      };
    } catch (error) {
      this.logger.error(`Error generando reporte de encuesta ${id}:`, error);
      throw error;
    }
  }
}
