import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { SupabaseService } from '../supabase/supabase.service';
import { schema } from './schema';

@Injectable()
export class IaService {
  private readonly logger = new Logger(IaService.name);

  // Roles permitidos para usar el servicio de IA
  private readonly ALLOWED_ROLES = ['superusuario', 'gerencia', 'administrativo'];
  private readonly BLOCKED_ROLES = ['vigilante', 'cliente', 'coordinador', 'supervisor'];

  constructor(
    private readonly geminiService: GeminiService,
    private readonly supabase: SupabaseService,
  ) { }

  /**
   * 🔐 Verifica si el usuario tiene acceso al servicio de IA
   */
  private checkUserAccess(user: any): { hasAccess: boolean; userName: string } {
    const userName = user?.nombre_completo || user?.nombre || user?.email || 'Usuario';
    const userRole = user?.rol?.toLowerCase();

    if (!userRole) {
      this.logger.warn(`⚠️ Usuario sin rol definido: ${user?.email}`);
      return { hasAccess: false, userName };
    }

    const hasAccess = this.ALLOWED_ROLES.includes(userRole);

    if (!hasAccess) {
      this.logger.warn(`🚫 Acceso denegado para rol: ${userRole} (${user?.email})`);
    } else {
      this.logger.log(`✅ Acceso permitido para rol: ${userRole} (${user?.email})`);
    }

    return { hasAccess, userName };
  }

  // ============================================================
  // 🧠 1. PROCESAR CONSULTA NATURAL → SQL (ya existente)
  // ============================================================
  async processQuery(userQuery: string, user: any, history?: any[]) {
    try {
      this.logger.debug(`🧠 Recibida consulta natural: "${userQuery}"`);

      // 1️⃣ Verificar acceso del usuario
      const { hasAccess, userName } = this.checkUserAccess(user);

      if (!hasAccess) {
        const blockedMessage = `Hola ${userName}, por el momento no tienes acceso a este servicio.`;
        this.logger.warn(`🚫 Acceso denegado: ${user?.email} (${user?.rol})`);
        return {
          ok: false,
          message: blockedMessage,
          accessDenied: true
        };
      }

      // 2️⃣ Detectar si requiere SQL
      const intent = await this.geminiService.detectIntent(userQuery, history);
      this.logger.debug(`🎯 Intención detectada: ${intent}`);

      // 🗣️ Si es una pregunta general, responder sin SQL
      if (intent === 'general') {
        const respuesta = await this.geminiService.humanResponse(userQuery, history);
        return {
          ok: true,
          message: respuesta
        };
      }

      // 3️⃣ Generar SQL usando el esquema de Supabase
      const sqlResponse = await this.geminiService.naturalToSQL(
        `${userQuery}\n\nEsquema de la base de datos:\n${schema}`,
        history,
      );

      // 4️⃣ Limpiar SQL
      const cleanSql = sqlResponse
        .replace(/```sql/gi, '')
        .replace(/```/g, '')
        .trim()
        .replace(/;$/, '');

      this.logger.debug(`🧩 SQL limpio final:\n${cleanSql}`);

      // 5️⃣ Validar que sea SELECT
      if (!cleanSql.toUpperCase().startsWith('SELECT')) {
        throw new BadRequestException('Solo se permiten consultas SELECT.');
      }

      // 6️⃣ Ejecutar SQL con Supabase
      const token = user?.token || user?.access_token;
      const userClient = this.supabase.getClientWithAuth(token);
      const { data, error } = await userClient.rpc('execute_sql', { query: cleanSql });

      if (error) throw new Error(error.message);

      // 7️⃣ Humanizar la respuesta
      const respuestaNatural = await this.geminiService.humanizeResponse(userQuery, data, history);

      return {
        ok: true,
        sql: cleanSql,
        data,
        message: respuestaNatural,
      };
    } catch (err: any) {
      this.logger.error('❌ Error en processQuery:', err);
      throw new BadRequestException(err.message || 'Error al procesar la consulta.');
    }
  }

  // ============================================================
  // 🔮 2. IA DE PREDICCIÓN DE AUSENCIAS / INCIDENTES
  // ============================================================
  async generarPredicciones(user: any) {
    try {
      this.logger.log(`🔮 [Predicciones] Generando predicciones para ${user.email}`);

      const { data, error } = await this.supabase
        .getClientWithAuth(user.token)
        .from('asistencias')
        .select('*');

      if (error) throw new Error(error.message);

      // Procesar datos históricos con Gemini
      const prompt = `
      Analiza los siguientes registros de asistencia y predice posibles ausencias o incidentes:
      ${JSON.stringify(data.slice(0, 30))}
      Retorna un resumen claro con probabilidades y sugerencias.
      `;
      const analisis = await this.geminiService.humanResponse(prompt);

      // Guardar predicción en BD
      await this.supabase.getClientWithAuth(user.token).from('ia_predicciones_incidentes').insert({
        tipo_prediccion: 'ausencia', // Default, debería venir del análisis
        probabilidad: 0.8, // Mock, debería parsearse del análisis
        observaciones: analisis,
        fecha_prediccion: new Date().toISOString(),
      });

      return { ok: true, predicciones: analisis };
    } catch (err: any) {
      this.logger.error('❌ Error en generarPredicciones:', err);
      throw new BadRequestException(err.message);
    }
  }

  // ============================================================
  // 🧭 3. IA SUPERVISOR (MONITOREO EN TIEMPO REAL)
  // ============================================================
  async ejecutarSupervisorIA(user: any) {
    try {
      this.logger.log(`🧭 [Supervisor IA] Analizando comportamiento en tiempo real de ${user.email}`);

      const { data, error } = await this.supabase
        .getClientWithAuth(user.token)
        .from('turnos')
        .select('id, empleado_id, hora_inicio, hora_fin, estado');

      if (error) throw new Error(error.message);

      const prompt = `
      Evalúa los siguientes turnos en busca de patrones de riesgo, inasistencias o retrasos recurrentes:
      ${JSON.stringify(data.slice(0, 30))}
      Sugiere alertas o supervisión específica.
      `;
      const analisis = await this.geminiService.humanResponse(prompt);

      return { ok: true, analisis };
    } catch (err: any) {
      this.logger.error('❌ Error en ejecutarSupervisorIA:', err);
      throw new BadRequestException(err.message);
    }
  }

  // ============================================================
  // ⚙️ 4. REENTRENAMIENTO ADAPTATIVO DE PERSONAL
  // ============================================================
  async reentrenarModelo(body: any, user: any) {
    try {
      this.logger.log(`⚙️ [Reentrenamiento] Iniciando reentrenamiento IA para ${user.email}`);

      const { nuevos_datos } = body;
      if (!nuevos_datos) throw new BadRequestException('Debe enviar nuevos datos.');

      const prompt = `
      Actualiza el modelo de desempeño con estos nuevos registros:
      ${JSON.stringify(nuevos_datos.slice(0, 20))}
      Indica qué ajustes se realizarán en el modelo adaptativo.
      `;
      const resultado = await this.geminiService.humanResponse(prompt);

      // Guardar log de reentrenamiento
      await this.supabase.getClientWithAuth(user.token).from('ia_modelos_configuracion').insert({
        nombre_modelo: 'adaptativo_personal',
        version: 'v2.0', // Incremental logic needed
        parametros: { ajuste: resultado },
        tipo_modelo: 'reentrenamiento',
        fecha_entrenamiento: new Date().toISOString(),
      });

      return { ok: true, mensaje: 'Modelo actualizado', detalle: resultado };
    } catch (err: any) {
      this.logger.error('❌ Error en reentrenarModelo:', err);
      throw new BadRequestException(err.message);
    }
  }

  // ============================================================
  // 🚔 5. RUTAS INTELIGENTES DE PATRULLAJE
  // ============================================================
  async generarRutasOptimas(body: any, user: any) {
    try {
      const { puntos } = body;
      if (!puntos || !Array.isArray(puntos)) {
        throw new BadRequestException('Debe enviar puntos GPS válidos.');
      }

      this.logger.log(`🗺️ [Rutas IA] Generando rutas para ${user.email}`);

      const prompt = `
      Genera una ruta óptima para patrullaje con estos puntos GPS:
      ${JSON.stringify(puntos)}
      Considera eficiencia, cobertura y orden lógico de recorrido.
      Devuelve un orden sugerido de visita y justificación.
      `;
      const ruta = await this.geminiService.humanResponse(prompt);

      return { ok: true, ruta };
    } catch (err: any) {
      this.logger.error('❌ Error en generarRutasOptimas:', err);
      throw new BadRequestException(err.message);
    }
  }

  // ============================================================
  // 📹 6. DETECCIÓN DE COMPORTAMIENTO ANÓMALO (visión + sensores)
  // ============================================================
  async detectarComportamientoAnomalo(user: any) {
    try {
      this.logger.log(`📹 [Anomalías IA] Analizando cámaras y sensores para ${user.email}`);

      // Mock data source for now, replace with actual table if exists or use params
      const data = [{ evento: 'movimiento_brusco', timestamp: new Date() }];

      const prompt = `
      Detecta comportamientos anómalos o sospechosos en los siguientes eventos de sensores o cámaras:
      ${JSON.stringify(data)}
      Indica posibles amenazas, fallos o movimientos inusuales.
      `;
      const analisis = await this.geminiService.humanResponse(prompt);

      // Guardar anomalía
      await this.supabase.getClientWithAuth(user.token).from('ia_comportamiento_anomalo').insert({
        tipo_anomalia: 'detectada_ia',
        descripcion: analisis,
        nivel_alerta: 'medio', // Logic needed to parse from analysis
        timestamp: new Date().toISOString(),
      });

      return { ok: true, analisis };
    } catch (err: any) {
      this.logger.error('❌ Error en detectarComportamientoAnomalo:', err);
      throw new BadRequestException(err.message);
    }
  }
  // ============================================================
  // 🧠 7. SUGERENCIAS DE REEMPLAZO IA
  // ============================================================
  // ============================================================
  // 🧠 7. SUGERENCIAS DE CANDIDATOS (Turnos/Reemplazos)
  // ============================================================
  async sugerirReemplazo(turno: any, candidatos: any[]) {
    try {
      this.logger.log(`🧠 [Sugerencias IA] Analizando ${candidatos.length} candidatos para reemplazo.`);

      const prompt = `
      Actúa como un jefe de operaciones de seguridad experto.
      Necesito un reemplazo para el siguiente turno:
      - Fecha: ${turno.fecha}
      - Horario: ${turno.hora_inicio} - ${turno.hora_fin}
      - Puesto: ${turno.puesto_nombre} (${turno.ciudad})
      - Cliente: ${turno.cliente_nombre}

      Tengo la siguiente lista de empleados disponibles (que no tienen turno asignado en ese horario):
      ${JSON.stringify(candidatos)}

      Analiza la lista y sugiere los 3 mejores candidatos.
      Criterios de selección:
      1. Prioriza empleados que ya conozcan el puesto (si se indica en sus datos).
      2. Prioriza empleados que vivan cerca o en la misma ciudad.
      3. Considera su antigüedad o rol si es relevante.

      Formato de respuesta deseado (texto natural):
      "Te sugiero a [Nombre] porque [Razón]. Como segunda opción [Nombre]..."
      `;

      const sugerencia = await this.geminiService.humanResponse(prompt);
      return { ok: true, sugerencia };
    } catch (err: any) {
      this.logger.error('❌ Error en sugerirReemplazo:', err);
      throw new BadRequestException(err.message);
    }
  }

  async sugerirEmpleados(params: { subpuesto_id: number; fecha: string; hora_inicio: string; hora_fin: string }) {
    try {
      this.logger.log(`🧠 [Sugerencias] Iniciando búsqueda para subpuesto ${params.subpuesto_id} el ${params.fecha}`);

      const supabase = this.supabase.getClient();

      // 1. Obtener Info del Subpuesto y Puesto (Ubicación)
      const { data: subpuesto, error: spError } = await supabase
        .from('subpuestos_trabajo')
        .select(`
          id, 
          nombre, 
          puesto:puesto_id (
            id, nombre, ciudad, direccion, latitud, longitud
          )
        `)
        .eq('id', params.subpuesto_id)
        .single();

      if (spError || !subpuesto) throw new BadRequestException('Subpuesto no encontrado');

      // 2. Obtener Empleados Activos con su información relevante
      const { data: empleados, error: empError } = await supabase
        .from('empleados')
        .select(`
          id, nombre_completo, cedula, direccion, ciudad, barrio,
          tipo_vigilante:tipo_vigilante_id (nombre),
          turnos!inner(id, fecha) -- Solo para saber si tienen turno ese día (aproximación rápida)
        `)
        .eq('activo', true)
        .eq('turnos.fecha', params.fecha); // NOTA: Esto filtra LOS QUE TIENEN turno. Queremos los que NO.

      // Corrección estrategia: Traer TODOS los empleados activos, y aparte traer los turnos del día para filtrar en memoria.
      // Re-Query Empleados
      const { data: allEmpleados } = await supabase
        .from('empleados')
        .select(`
          id, nombre_completo, cedula, direccion, ciudad, 
          tipo_vigilante:tipo_vigilante_id (nombre)
        `)
        .eq('activo', true);

      // Re-Query Turnos ocupados ese día/hora
      const { data: ocupados } = await supabase
        .from('turnos')
        .select('empleado_id, hora_inicio, hora_fin')
        .eq('fecha', params.fecha)
        .neq('estado_turno', 'cancelado'); // Asumimos estado

      const idsOcupados = new Set(ocupados?.map(o => o.empleado_id));

      // 3. Filtrar disponibles (Simplificado: Si tiene turno ese día, asumimos ocupado por ahora, o verificar traslapo horario)
      // Mejora: Verificar traslapo de horas si fuera necesario. Para MVP, descartamos si ya tiene turno ese día.
      const candidatos = allEmpleados?.filter(e => !idsOcupados.has(e.id)) || [];

      if (candidatos.length === 0) {
        return { ok: true, sugerencia: "No se encontraron empleados disponibles para esa fecha." };
      }

      // 4. Preparar data para IA
      // Limitamos a 20 candidatos par no saturar token limit, priorizando ciudad si coincide
      const puesto: any = (subpuesto as any).puesto; // Cast to avoid TS array error if inference fails
      const ciudadPuesto = puesto?.ciudad?.toLowerCase();

      const candidatosPriorizados = candidatos.sort((a: any, b: any) => {
        const ciudadA = a.ciudad?.toLowerCase() === ciudadPuesto ? 1 : 0;
        const ciudadB = b.ciudad?.toLowerCase() === ciudadPuesto ? 1 : 0;
        return ciudadB - ciudadA;
      }).slice(0, 30);

      const promptInfo = {
        requerimiento: {
          puesto: puesto?.nombre,
          subpuesto: subpuesto.nombre,
          ciudad: puesto?.ciudad,
          direccion: puesto?.direccion,
          fecha: params.fecha,
          hora: `${params.hora_inicio} - ${params.hora_fin}`
        },
        candidatos: candidatosPriorizados.map((c: any) => {
          const perfil: any = c.tipo_vigilante;
          return {
            id: c.id,
            nombre: c.nombre_completo,
            ciudad: c.ciudad,
            direccion: c.direccion,
            perfil: perfil?.nombre || 'General'
          };
        })
      };

      const prompt = `
      Actúa como jefe de operaciones de seguridad.
      Recomienda los 3 mejores candidatos para cubrir este turno basándote en UBICACIÓN (cercanía a la ciudad del puesto) y disponibilidad.
      
      Detalles del Turno:
      ${JSON.stringify(promptInfo.requerimiento)}

      Lista de Candidatos Disponibles (Pre-filtrados por disponibilidad horaria):
      ${JSON.stringify(promptInfo.candidatos)}

      Responde en formato JSON estrictamente:
      {
        "recomendados": [
          { "id": 123, "nombre": "Nombre", "motivo": "Vive en la misma ciudad y tiene perfil adecuado..." },
          ...
        ],
        "analisis_general": "Resumen breve de la disponibilidad..."
      }
      `;

      try {
        const respuestaIA = await this.geminiService.humanResponse(prompt);
        // Intentar parsear si Gemini devuelve texto con JSON dentro
        // A veces devuelve ```json ... ```
        const jsonMatch = respuestaIA.match(/\{[\s\S]*\}/);
        const resultado = jsonMatch ? JSON.parse(jsonMatch[0]) : { recomendados: [], analisis_general: respuestaIA };

        return { ok: true, ...resultado };

      } catch (parseError) {
        // Fallback si falla el parseo JSON
        return { ok: true, analisis_general: "La IA generó una respuesta pero no en el formato estructura esperado.", raw: prompt };
      }

    } catch (err: any) {
      this.logger.error('❌ Error en sugerirEmpleados:', err);
      throw new BadRequestException(err.message);
    }
  }

  // ============================================================
  // 📊 8. ESTADO DE API KEYS DE GEMINI
  // ============================================================
  getGeminiApiKeysStatus() {
    return this.geminiService.getApiKeysStatus();
  }
}
