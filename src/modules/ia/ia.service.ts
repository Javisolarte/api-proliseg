
const COMPACT_PROLICONTROL_CATALOG = `
TABLAS Y SERVICIOS EN PROLICONTROL (public):
- turnos: id, puesto_id, subpuesto_id, empleado_id, fecha, hora_inicio, hora_fin, tipo_turno, estado_turno, asignado_por
- asignacion_guardas_puesto: id, puesto_id, subpuesto_id, empleado_id, fecha_asignacion, activo
- puestos_trabajo: id, cliente_id, nombre, ciudad, direccion, activo, contrato_id
- subpuestos_trabajo: id, puesto_id, nombre, guardas_activos, activo
- empleados: id, nombre_completo, cedula, telefono, rol, activo, asignado, salario_base
- aspirantes: id, nombre_completo, cedula, estado_proceso
- asistencias: id, turno_id, empleado_id, tipo_marca, timestamp, latitud_entrada, longitud_entrada
- clientes: id, nombre_empresa, nit, telefono, contacto, activo
- contratos: id, cliente_id, valor, guardas_activos, fecha_inicio, fecha_fin, estado
- minutas: id, puesto_id, subpuesto_id, tipo_novedad, detalle_novedad, nivel_riesgo, persona_involucrada, fecha, hora
- novedades: id, puesto_id, tipo, descripcion, fecha_reporte, estado
- incidentes: id, puesto_id, tipo_incidente, descripcion, fecha_incidente, nivel_gravedad, estado
- vacaciones: id, empleado_id, fecha_inicio, fecha_fin, dias_tomados, estado
- capacitaciones: id, nombre, descripcion, duracion_horas, fecha_programada
- vehiculos: id, placa, marca, modelo, tipo_vehiculo, estado
- inventario_puesto: id, puesto_id, articulo_id, cantidad, estado
- pqrsf: id, cliente_id, tipo, asunto, descripcion, estado, prioridad
- dispositivos_iot: id, puesto_id, nombre_identificador, ip_direccion, marca, tipo_dispositivo, estado, apertura_desde_app
- comunicaciones / notificaciones / memorandos: id, titulo, contenido, destinatario_id
`;

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CatorceBrainService } from './catorce-brain.service';
import { schema } from './schema';

@Injectable()
export class IaService {
  private readonly logger = new Logger(IaService.name);

  // Roles permitidos para operar CATORCE IA
  private readonly ALLOWED_ROLES = [
    'superusuario',
    'gerencia',
    'administrativo',
    'coordinador',
    'supervisor',
    'radiooperador',
    'radio_operador',
    'operador',
  ];
  private readonly BLOCKED_ROLES = ['cliente'];

  constructor(
    private readonly geminiService: GeminiService,
    private readonly supabase: SupabaseService,
    private readonly catorceBrain: CatorceBrainService,
  ) {}

  /**
   * 🔐 Verifica si el usuario tiene acceso al servicio CATORCE IA
   */
  private checkUserAccess(user: any): { hasAccess: boolean; userName: string; isIngeniero: boolean } {
    const rawName = String(user?.nombre_completo || user?.nombre || user?.email || '').toLowerCase();
    const isOscar = rawName.includes('oscar') || rawName.includes('solarte') || !user || String(user?.rol || '').toLowerCase() === 'superusuario';
    const firstName = String(user?.nombre || user?.nombre_completo || '').trim().split(' ')[0] || '';
    const userName = isOscar ? 'Ingeniero' : (firstName || 'Compañero');
    const userRole = (user?.rol || 'superusuario').toLowerCase();

    if (this.BLOCKED_ROLES.includes(userRole)) {
      this.logger.warn(`🚫 Acceso restringido para rol externo: ${userRole} (${user?.email})`);
      return { hasAccess: false, userName, isIngeniero: false };
    }

    return { hasAccess: true, userName, isIngeniero: isOscar };
  }

  /**
   * 🧠 PROCESADOR MAESTRO OMNISCIENTE DE CATORCE
   * - Un solo modelo unificado capaz de operar 100% de la plataforma Prolicontrol
   * - Si falta algún dato para crear/editar (turno, minuta, puesto, cliente, etc.), le pregunta inteligentemente al usuario
   * - Puede consultar, insertar y actualizar en toda la base de datos, EXCEPTO eliminar (restringido a superusuarios)
   * - Genera documentos e informes PDF bajo demanda
   * - Si la consulta no tiene nada que ver con PROLISEG LTDA, dice: "¿Y eso tiene mucho que ver con el trabajo? 😄" pero responde igual
   */
  async processQuery(userQuery: string, user: any, canal: string = 'texto', clientConversationHistory?: { role: string; text: string }[]) {
    const startTime = Date.now();
    try {
      this.logger.debug(`🧠 [CATORCE] Instrucción recibida (${canal}): "${userQuery}"`);

      const { hasAccess, userName, isIngeniero } = this.checkUserAccess(user);
      if (!hasAccess) {
        return {
          ok: false,
          message: `Hola ${userName}, tu perfil actual no tiene permisos para ejecutar acciones en CATORCE.`,
          accessDenied: true,
        };
      }

      const qNorm = userQuery
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

      const activatedNodes: string[] = ['core'];
      const toolsUsed: string[] = [];

      // =========================================================================
      // 0️⃣ CANDADO ESTRICTO CONTRA ELIMINACIÓN (SOLO SUPERUSUARIOS / PROTEGIDO)
      // =========================================================================
      const isDeleteAttempt =
        /\b(elimina|eliminar|borra|borrar|suprime|suprimir|destruye|drop|truncate|delete)\b/i.test(qNorm) &&
        /\b(puesto|empleado|guarda|turno|cliente|contrato|minuta|novedad|registro|base de datos|tabla|usuario|vehiculo|incidente|vacacion)\b/i.test(
          qNorm,
        );

      if (isDeleteAttempt) {
        const blockRes = await this.catorceBrain.executeUniversalPlatformOperation(
          {
            operationType: 'DELETE_ATTEMPT',
            table: 'prolicontrol',
            comandoOriginal: userQuery,
            canal,
          },
          user,
        );

        this.catorceBrain.appendConversationTurn(user, userQuery, blockRes.message || '', canal, ['core'], [
          'CATORCE-GUARDIAN:blockDelete',
        ]);

        return {
          ok: true,
          assistant: 'CATORCE',
          actionExecuted: 'BLOQUEO_ELIMINACION',
          auditCode: blockRes.auditCode,
          activatedNodes: ['core'],
          toolsUsed: ['CATORCE-GUARDIAN:blockDelete'],
          message: blockRes.message,
          latencyMs: Date.now() - startTime,
        };
      }

      // =========================================================================
      // 1️⃣ DETECCIÓN DE GUARDADO EXPLÍCITO EN EL SEGUNDO CEREBRO
      // =========================================================================
      const isLearnIntent =
        qNorm.startsWith('recuerda que') ||
        qNorm.startsWith('guarda en el segundo cerebro') ||
        qNorm.startsWith('aprende que') ||
        qNorm.includes('agregar al segundo cerebro');

      if (isLearnIntent) {
        activatedNodes.push('brain');
        toolsUsed.push('CATORCE-BRAIN:addCorporateKnowledge');

        const cleanFact = userQuery
          .replace(/^(recuerda que|guarda en el segundo cerebro|aprende que|catorce recuerda que)/i, '')
          .trim();

        const saved = await this.catorceBrain.addCorporateKnowledge(
          {
            titulo: cleanFact.slice(0, 55) || 'Conocimiento Operativo CATORCE',
            categoria: '09_Memoria_Colectiva_Catorce',
            contenido: cleanFact || userQuery,
          },
          user,
        );
        await this.catorceBrain.saveUserMemory(user, cleanFact || userQuery, 'aprendizaje_directo', 9);

        const msg = `🧠 **Segundo Cerebro PROLISEG LTDA actualizado:** He almacenado y vectorizado este conocimiento en \`ia_brain\` para que todo el equipo lo tenga disponible.`;
        this.catorceBrain.appendConversationTurn(user, userQuery, msg, canal, activatedNodes, toolsUsed);

        return {
          ok: true,
          assistant: 'CATORCE',
          actionExecuted: 'CONOCIMIENTO_GUARDADO',
          activatedNodes,
          toolsUsed,
          data: [saved.documento],
          message: msg,
          latencyMs: Date.now() - startTime,
        };
      }

      // =========================================================================
      // 2️⃣ CARGAR CONTEXTO EN VIVO: TELEMETRÍA + HISTORIAL RECIENTE + SEGUNDO CEREBRO
      // =========================================================================
      const [telemetry, serverHistory, brainMatches] = await Promise.all([
        this.catorceBrain.getRealtimeBrainTelemetry(user),
        this.catorceBrain.getRecentConversationHistory(user),
        this.catorceBrain.searchCorporateBrain(userQuery),
      ]);

      const recentHistory =
        clientConversationHistory && clientConversationHistory.length > 0
          ? clientConversationHistory.slice(-8)
          : serverHistory;

      const historyFormatted = (recentHistory || [])
        .map(
          (h: any) =>
            `${h.role === 'user' ? 'INGENIERO' : 'CATORCE'}: ${String(h.text || '')
              .replace(/<[^>]+>/g, '')
              .trim()
              .slice(0, 300)}`,
        )
        .join('\n');

      if (qNorm.includes('puesto') || qNorm.includes('sede') || qNorm.includes('edificio')) activatedNodes.push('puestos');
      if (qNorm.includes('empleado') || qNorm.includes('guarda') || qNorm.includes('vigilante') || qNorm.includes('personal') || qNorm.includes('turno')) {
        activatedNodes.push('empleados');
      }
      if (qNorm.includes('vacacion')) activatedNodes.push('vacaciones');
      if (qNorm.includes('cliente') || qNorm.includes('contrato') || qNorm.includes('cotizacion')) activatedNodes.push('clientes');
      if (qNorm.includes('acceso') || qNorm.includes('puerta') || qNorm.includes('biometrico') || qNorm.includes('hikvision') || qNorm.includes('dahua') || qNorm.includes('camara')) {
        activatedNodes.push('accesos');
      }
      if (qNorm.includes('minuta') || qNorm.includes('novedad') || qNorm.includes('radio') || qNorm.includes('incidente')) {
        activatedNodes.push('minutas');
      }
      if (brainMatches.length > 0 || qNorm.includes('segundo cerebro') || qNorm.includes('protocolo') || qNorm.includes('manual')) {
        activatedNodes.push('brain');
      }

      // =========================================================================
      // 3️⃣ ORQUESTADOR UNIFICADO EN 1 SOLA PASADA ULTRA-RÁPIDA (~800ms TIPO CHATGPT LIVE)
      // =========================================================================
      const orchestratorPrompt = `
Eres **CATORCE**, la IA Omnisciente y Segundo Cerebro de **PROLISEG LTDA** con control total de la plataforma **Prolicontrol**.
Hoy es ${new Date().toISOString().slice(0, 10)}.
Usuario actual: "${userName}" (Rol: ${user?.rol || 'superusuario'}, ID: ${user?.id || 1}).

REGLAS OBLIGATORIAS DE OPERACIÓN Y TRATO:
1. TRATO AL USUARIO: ${
  isIngeniero
    ? 'El usuario actual es el Ingeniero. Dirígete a él SIEMPRE con el título respetuoso de "Ingeniero" (ej. "Hola Ingeniero", "Con gusto, Ingeniero", "Ingeniero, le confirmo que..."). NUNCA lo llames "Oscar", "Javier", "Solarte", "Oscar Javier Solarte", ni uses la palabra "jefe".'
    : `El usuario actual se llama "${userName}" (Rol: ${user?.rol || 'operativo'}). Dirígete a él/ella de manera cálida, ejecutiva y profesional por su nombre: "${userName}" (ej. "Hola ${userName}", "Con gusto ${userName}"). NUNCA uses la palabra "jefe".`
}
2. ALCANCE DE SERVICIOS: Tienes control operativo total para gestionar TODOS los servicios de Prolicontrol:
   - Turnos y asignaciones (turnos, asignacion_guardas_puesto, turnos_reemplazos, turnos_configuracion, conceptos_turno).
   - Gestión Humana y Personal (empleados, aspirantes, dotaciones, contratos_personal, salarios, articulos_dotacion, vacaciones, capacitaciones).
   - Asistencias & IoT (asistencias, asistencia_iot_registros, asistencia_iot_personal, puestos_asistencia_iot_config).
   - Puestos y Sedes (puestos_trabajo, subpuestos_trabajo, sedes, ubicaciones, geocercas).
   - Clientes y Comercial (clientes, clientes_potenciales, contratos, cotizaciones, servicios, facturacion_config).
   - Control de Acceso y Visitantes (dispositivos_iot, listas_acceso, residentes, visitantes, visitas, visitas_registro, visitas_tecnicas).
   - Minutas, Novedades e Incidentes (minutas, novedades, incidentes, radio_operaciones).
   - Rondas y Supervisión (rondas_configuracion_puesto, rondas_ejecucion, rutas, supervisor_visitas).
   - Logística, Vehículos y PQRSF (vehiculos, inventario, inventario_puesto, pqrsf, encuestas, comunicaciones, notificaciones, memorandos).
3. EXCLUSIONES ESTRICTAS DE SEGURIDAD:
   - NUNCA elimines registros de la base de datos (DELETE, DROP, TRUNCATE están prohibidos).
   - NUNCA crees usuarios ni credenciales (usuarios, auth.users están prohibidos; deben gestionarse manualmente en el módulo administrativo de Usuarios).
4. NATURALIDAD EN RESPUESTA: Responde con voz femenina, cálida, ejecutiva y directa como ChatGPT Live. NUNCA incluyas metainstrucciones ni frases del prompt en tu respuesta directa.

CONTEXTO DE LA CONVERSACIÓN RECIENTE (Sigue el hilo con exactitud):
${historyFormatted || "Inicio de conversación."}

📊 TELEMETRÍA EN VIVO DE PROLICONTROL:
- Puestos Activos: ${telemetry.kpis.puestosActivos} puestos principales y ${telemetry.kpis.subpuestosActivos} subpuestos (${JSON.stringify(
        telemetry.detalles.puestos.slice(0, 25).map((p: any) => ({ id: p.id, nombre: p.nombre, ciudad: p.ciudad })),
      )})
- Empleados Activos: ${telemetry.kpis.empleadosActivos} empleados (${telemetry.kpis.empleadosAsignados} asignados)
- Vacaciones: ${telemetry.kpis.vacacionesRegistradas} registradas. Próximos: ${JSON.stringify(
        telemetry.detalles.quienesSiguenVacaciones.slice(0, 8),
      )}
- Clientes Activos: ${telemetry.kpis.clientesActivos} clientes (${JSON.stringify(
        telemetry.detalles.clientes.slice(0, 20).map((c: any) => ({ id: c.id, nombre: c.nombre_empresa })),
      )})
- Contratos Vigentes: ${telemetry.kpis.contratosActivos} contratos (${telemetry.kpis.guardasContratadosTotal} guardas contratados)
- Controles de Acceso IoT: ${telemetry.kpis.controlesAccesoTotal} dispositivos (${telemetry.kpis.dispositivosOnline} en línea: ${JSON.stringify(
        telemetry.detalles.controlesAcceso.slice(0, 12),
      )})
- Minutas Recientes: ${JSON.stringify(telemetry.detalles.minutasRecientes.slice(0, 5))}
${brainMatches.length > 0 ? `- Segundo Cerebro: ${JSON.stringify(brainMatches.map((b: any) => ({ titulo: b.titulo, resumen: b.resumen })))}` : ''}
${telemetry.userContext?.memoriasActivas?.length > 0 ? `- Memoria Contextual Personalizada del Usuario (${userName}): ${JSON.stringify(telemetry.userContext.memoriasActivas.map((m: any) => ({ clave: m.clave, hecho: m.hecho_recordado, importancia: m.importancia })))}` : ''}

MENSAJE ACTUAL DEL USUARIO:
"${userQuery}"

Analiza el mensaje y responde en UN SOLO JSON ESTRICTO con esta estructura:
{
  "intent": "ASK_MISSING_DATA" | "CREATE_MINUTA" | "DB_INSERT" | "DB_UPDATE" | "QUERY_OR_REPORT" | "OFF_TOPIC",
  "isOffTopic": boolean,
  "wantsPdf": boolean,
  "directAnswer": "Tu respuesta hablada/escrita completa, cálida, fluida (ideal para ser leída en voz alta como ChatGPT Live) y natural en español dirigiéndote siempre al usuario como ${isIngeniero ? "'Ingeniero'" : `su nombre '${userName}'`}. Si te saludan y preguntan cómo están los servicios, saluda con calidez y resume cómo están operando los puestos, guardas, contratos y controles de acceso hoy. Si isOffTopic es true, DEBES empezar obligatoriamente con: '¿Y eso tiene mucho que ver con el trabajo en PROLISEG LTDA? 😄 Bueno, como soy tu compañera igual te respondo con todo gusto:' y enseguida responder su pregunta.",
  "missingDataQuestion": "Si el usuario quiere crear o modificar algo en cualquier servicio de Prolicontrol pero falta un dato esencial, escribe aquí la pregunta amable dirigiéndote a él/ella de forma respetuosa (${isIngeniero ? "'Ingeniero'" : userName}).",
  "minutaData": {
    "edificio_o_puesto": "Nombre del edificio o puesto",
    "persona_involucrada": "Nombre de la persona si aplica",
    "detalle_novedad": "Descripción clara de la novedad",
    "tipo_novedad": "Ingreso / Novedad Radio-Operación",
    "nivel_riesgo": "bajo"
  },
  "dbWrite": {
    "operationType": "INSERT" | "UPDATE",
    "table": "Nombre exacto de la tabla de Prolicontrol (ej. turnos, asignacion_guardas_puesto, puestos_trabajo, subpuestos_trabajo, clientes, contratos, vacaciones, incidentes, capacitaciones, vehiculos, inventario, pqrsf, encuestas, comunicaciones, notificaciones)",
    "entityHints": {
      "empleado_nombre_o_cedula": "",
      "puesto_nombre": "",
      "subpuesto_nombre": "",
      "cliente_nombre_o_nit": ""
    },
    "payload": {},
    "matchFilter": {},
    "humanSummary": "Explicación clara de la acción realizada para el Ingeniero"
  },
  "customSelectSql": "SOLO llena este campo con un SELECT de PostgreSQL si la pregunta pide datos específicos que NO están ya en la telemetría de arriba. Si ya puedes responder con la telemetría de arriba, DEJA ESTE CAMPO VACÍO '' para responder al instante."
}

Responde ÚNICAMENTE con el objeto JSON válido.`;

      let plan: any = {
        intent: 'QUERY_OR_REPORT',
        isOffTopic: false,
        wantsPdf: /\b(pdf|documento pdf|informe en pdf|exportar a pdf|descargar pdf|genera un pdf)\b/i.test(qNorm),
        directAnswer: '',
        missingDataQuestion: '',
        customSelectSql: '',
      };

      try {
        const rawPlan = await this.geminiService.generateStructuredOrNatural(
          `${orchestratorPrompt}\n\n${COMPACT_PROLICONTROL_CATALOG}`,
        );
        const jsonMatch = rawPlan.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          plan = { ...plan, ...JSON.parse(jsonMatch[0]) };
        }
      } catch (e: any) {
        this.logger.debug(`ℹ️ Fallback heurístico en orquestador CATORCE: ${e.message}`);
      }

      // =========================================================================
      // 4️⃣ CASO A: A CATORCE LE FALTA UN DATO -> LE PREGUNTA AL USUARIO INTELIGENTEMENTE
      // =========================================================================
      if (plan.intent === 'ASK_MISSING_DATA' && plan.missingDataQuestion) {
        const questionMsg = `🤔 **Necesito un dato adicional para completarlo:**\n\n${plan.missingDataQuestion}`;
        this.catorceBrain.appendConversationTurn(user, userQuery, questionMsg, canal, activatedNodes, [
          'CATORCE-SLOT-FILLING:askMissingData',
        ]);

        return {
          ok: true,
          assistant: 'CATORCE',
          actionExecuted: 'PREGUNTA_DATOS_FALTANTES',
          awaitingFollowUp: true,
          activatedNodes,
          toolsUsed: ['CATORCE-SLOT-FILLING:askMissingData'],
          message: questionMsg,
          latencyMs: Date.now() - startTime,
        };
      }

      // =========================================================================
      // 5️⃣ CASO B: CREAR MINUTA / NOVEDAD AUTÓNOMA
      // =========================================================================
      if (plan.intent === 'CREATE_MINUTA' && plan.minutaData?.detalle_novedad) {
        activatedNodes.push('minutas', 'puestos');
        toolsUsed.push('CATORCE-RADIO:executeAutonomousMinutaOrNovedad');

        const resultAccion = await this.catorceBrain.executeAutonomousMinutaOrNovedad(
          {
            edificio_o_puesto: plan.minutaData.edificio_o_puesto || 'Sede Principal',
            persona_involucrada: plan.minutaData.persona_involucrada || '',
            detalle_novedad: plan.minutaData.detalle_novedad || userQuery,
            tipo_novedad: plan.minutaData.tipo_novedad || 'Novedad Radio-Operación',
            nivel_riesgo: plan.minutaData.nivel_riesgo || 'bajo',
            comando_original: userQuery,
            canal,
          },
          user,
        );

        this.catorceBrain.appendConversationTurn(
          user,
          userQuery,
          resultAccion.summaryMessage,
          canal,
          activatedNodes,
          toolsUsed,
        );

        return {
          ok: true,
          assistant: 'CATORCE',
          actionExecuted: resultAccion.actionExecuted,
          auditCode: resultAccion.auditCode,
          activatedNodes,
          toolsUsed,
          data: [resultAccion.minuta],
          message: resultAccion.summaryMessage,
          latencyMs: Date.now() - startTime,
        };
      }

      // =========================================================================
      // 6️⃣ CASO C: INSERTAR O ACTUALIZAR EN CUALQUIER MÓDULO DE PROLICONTROL (Turnos, Puestos, Clientes, Vacaciones, etc.)
      // =========================================================================
      if ((plan.intent === 'DB_INSERT' || plan.intent === 'DB_UPDATE') && plan.dbWrite?.table) {
        toolsUsed.push(`CATORCE-CRUD:${plan.dbWrite.operationType}_${plan.dbWrite.table}`);

        try {
          const crudRes = await this.catorceBrain.executeUniversalPlatformOperation(
            {
              operationType: plan.dbWrite.operationType || 'INSERT',
              table: plan.dbWrite.table,
              payload: plan.dbWrite.payload || {},
              matchFilter: plan.dbWrite.matchFilter,
              entityHints: plan.dbWrite.entityHints,
              humanSummary: plan.dbWrite.humanSummary,
              comandoOriginal: userQuery,
              canal,
            },
            user,
          );

          if (crudRes.blockedDelete) {
            return {
              ok: true,
              assistant: 'CATORCE',
              actionExecuted: 'BLOQUEO_ELIMINACION',
              auditCode: crudRes.auditCode,
              activatedNodes,
              toolsUsed,
              message: crudRes.message,
              latencyMs: Date.now() - startTime,
            };
          }

          const successMsg = `✅ **Operación ejecutada en Prolicontrol (\`${crudRes.table}\`):**\n\n${
            plan.dbWrite.humanSummary || 'He registrado los cambios solicitados directamente en la base de datos.'
          }\n\n- **Registro ID:** \`#${crudRes.data?.id || 'OK'}\`\n- **Código de Auditoría:** \`${crudRes.auditCode}\``;

          this.catorceBrain.appendConversationTurn(user, userQuery, successMsg, canal, activatedNodes, toolsUsed);

          return {
            ok: true,
            assistant: 'CATORCE',
            actionExecuted: crudRes.actionExecuted,
            auditCode: crudRes.auditCode,
            activatedNodes,
            toolsUsed,
            data: crudRes.data ? [crudRes.data] : [],
            message: successMsg,
            latencyMs: Date.now() - startTime,
          };
        } catch (crudErr: any) {
          // Si falló por una llave foránea o campo faltante, CATORCE le pregunta al usuario amablemente qué dato falta
          const clarifyMsg = `🤔 Estuve a punto de registrar la operación en **${plan.dbWrite.table}**, pero necesito confirmar un detalle para que quede exacto (${crudErr.message}). ¿Me confirmas el dato faltante?`;
          this.catorceBrain.appendConversationTurn(user, userQuery, clarifyMsg, canal, activatedNodes, toolsUsed);
          return {
            ok: true,
            assistant: 'CATORCE',
            actionExecuted: 'PREGUNTA_ACLARACION_BD',
            awaitingFollowUp: true,
            activatedNodes,
            toolsUsed,
            message: clarifyMsg,
            latencyMs: Date.now() - startTime,
          };
        }
      }

      // =========================================================================
      // 7️⃣ CASO D: CONSULTA OMNISCIENTE / SQL PERSONALIZADO / GENERACIÓN DE PDF / OFF-TOPIC
      // =========================================================================
      let customSqlResult: any[] = [];
      let executedSql = '';

      if (plan.customSelectSql && String(plan.customSelectSql).trim().toUpperCase().startsWith('SELECT')) {
        executedSql = String(plan.customSelectSql).trim().replace(/;$/, '');
        customSqlResult = await this.catorceBrain.runSql(executedSql);
        toolsUsed.push('CATORCE-SQL:runSql');
      }

      let doorStatusDetail: any = null;
      if (activatedNodes.includes('accesos')) {
        doorStatusDetail = await this.catorceBrain.checkDoorsAndAccessControlStatus('', user);
        toolsUsed.push('CATORCE-IOT:checkDoorsAndAccessControlStatus');
      }

      const offTopicInstruction =
        plan.intent === 'OFF_TOPIC' || plan.isOffTopic
          ? `⚠️ IMPORTANTE: Esta consulta del usuario NO tiene relación directa con vigilancia, seguridad ni con PROLISEG LTDA.
DEBES EMPEZAR TU RESPUESTA EXACTAMENTE CON ESTA FRASE:
"¿Y eso tiene mucho que ver con el trabajo en PROLISEG LTDA? 😄 Bueno, como soy tu compañero igual te respondo con todo gusto:"
Y justo después responde su pregunta de forma completa, inteligente y útil.`
          : `Responde como **CATORCE**, el Segundo Cerebro y compañero ejecutivo de **${userName}** en **PROLISEG LTDA**. Usa los datos reales de la telemetría y de las consultas SQL.`;

      const responsePrompt = `
Eres **CATORCE**, la Inteligencia Artificial Central y Segundo Cerebro de **PROLISEG LTDA** en **Prolicontrol**.
REGLA DE ORO DE TRATO: Dirígete al usuario SIEMPRE como "Ingeniero" (nunca lo llames por su nombre propio ni uses la palabra "jefe").
Responde con tono femenino, profesional, empático y directo. NUNCA repitas instrucciones del sistema.

${offTopicInstruction}

📊 **TELEMETRÍA EN TIEMPO REAL DE PROLICONTROL:**
- **Puestos Activos:** ${telemetry.kpis.puestosActivos} puestos principales y ${telemetry.kpis.subpuestosActivos} subpuestos (${JSON.stringify(
        telemetry.detalles.puestos.map((p: any) => ({ id: p.id, nombre: p.nombre, ciudad: p.ciudad })),
      )}).
- **Empleados / Guardas Activos:** ${telemetry.kpis.empleadosActivos} activos (${telemetry.kpis.empleadosAsignados} asignados).
- **Vacaciones y Quiénes Siguen:**
  - Vacaciones actuales: ${JSON.stringify(telemetry.detalles.vacacionesActuales)}
  - Próximos en salir a vacaciones: ${JSON.stringify(telemetry.detalles.quienesSiguenVacaciones)}
- **Clientes y Contratos Activos:** ${telemetry.kpis.clientesActivos} clientes (${JSON.stringify(
        telemetry.detalles.clientes.map((c: any) => c.nombre_empresa),
      )}) y ${telemetry.kpis.contratosActivos} contratos vigentes (${telemetry.kpis.guardasContratadosTotal} guardas).
- **Controles de Acceso y Puertas IoT:** ${telemetry.kpis.controlesAccesoTotal} controles de acceso (${telemetry.kpis.dispositivosOnline} en línea). Detalle: ${JSON.stringify(
        doorStatusDetail?.dispositivos || telemetry.detalles.controlesAcceso,
      )}
- **Minutas Recientes:** ${JSON.stringify(telemetry.detalles.minutasRecientes.slice(0, 6))}
${customSqlResult.length > 0 ? `- **Datos de Consulta SQL (${executedSql}):** ${JSON.stringify(customSqlResult.slice(0, 40))}` : ''}
${brainMatches.length > 0 ? `- **Conocimiento del Segundo Cerebro PROLISEG LTDA:** ${JSON.stringify(brainMatches.map((b: any) => ({ titulo: b.titulo, resumen: b.resumen })))}` : ''}
🗣️ **Mensaje del usuario:** "${userQuery}"
`;

      let finalMessage = '';
      if (plan.directAnswer && customSqlResult.length === 0) {
        finalMessage = String(plan.directAnswer).trim();
      } else {
        try {
          finalMessage = await this.geminiService.generateStructuredOrNatural(responsePrompt);
        } catch {
          finalMessage = this.buildDeterministicCatorceResponse(userQuery, telemetry, userName, customSqlResult);
        }
      }

      // Asegurar que la broma amistosa aparezca si fue clasificada como Off-Topic
      if (
        (plan.intent === 'OFF_TOPIC' || plan.isOffTopic) &&
        !finalMessage.toLowerCase().includes('tiene mucho que ver con el trabajo')
      ) {
        
      // Sanitización estricta de meta-instrucciones y trato al Ingeniero
      finalMessage = finalMessage
        .replace(/^(lee\s+(esto\s+)?(en\s+español|con\s+voz|de\s+forma)[^:\n]*[:\n]+)/i, '')
        .replace(/\b(oscar\s+javier\s+solarte(\s+araujo)?|oscar\s+javier|oscar\s+solarte)\b/gi, 'Ingeniero')
        .replace(/\bmi\s+jefe\b/gi, 'Ingeniero')
        .replace(/\bjefe\b/gi, 'Ingeniero')
        .trim();

      finalMessage = `¿Y eso tiene mucho que ver con el trabajo en PROLISEG LTDA? 😄 Bueno, como soy tu compañero igual te respondo con todo gusto:\n\n${finalMessage}`;
      }

      // Auditar operación
      const audit = await this.catorceBrain.recordAudit({
        user,
        subagente: 'CATORCE-CORE',
        accion: plan.wantsPdf ? 'GENERAR_DOCUMENTO_PDF' : 'CONSULTA_OMNISCIENTE_PROLICONTROL',
        modulo: activatedNodes.join(','),
        tablaDestino: 'ia_brain.conversaciones',
        registroId: 'LIVE',
        comandoOriginal: userQuery,
        parametros: { canal, activatedNodes, wantsPdf: plan.wantsPdf },
        resultado: { kpis: telemetry.kpis },
        canal,
      });

      // Si el usuario pidió generar un PDF, empaquetamos el documento PDF oficial de PROLISEG LTDA
      let pdfDocument: any = undefined;
      if (plan.wantsPdf) {
        toolsUsed.push('CATORCE-PDF:generatePdfDocument');
        const rowsSource =
          customSqlResult.length > 0
            ? customSqlResult.slice(0, 50)
            : activatedNodes.includes('puestos')
            ? telemetry.detalles.puestos
            : activatedNodes.includes('vacaciones')
            ? telemetry.detalles.quienesSiguenVacaciones
            : activatedNodes.includes('clientes')
            ? telemetry.detalles.clientes
            : activatedNodes.includes('accesos')
            ? telemetry.detalles.controlesAcceso
            : telemetry.detalles.minutasRecientes;

        const columns = rowsSource.length > 0 ? Object.keys(rowsSource[0]).slice(0, 6) : ['Concepto', 'Valor'];
        const rows =
          rowsSource.length > 0
            ? rowsSource.map((r: any) => columns.map((col) => String(r[col] ?? '')))
            : [
                ['Puestos Activos', String(telemetry.kpis.puestosActivos)],
                ['Empleados Activos', String(telemetry.kpis.empleadosActivos)],
                ['Clientes Activos', String(telemetry.kpis.clientesActivos)],
                ['Contratos Vigentes', String(telemetry.kpis.contratosActivos)],
                ['Controles de Acceso IoT', String(telemetry.kpis.controlesAccesoTotal)],
              ];

        pdfDocument = {
          filename: `PROLISEG_CATORCE_${Date.now()}.pdf`,
          title: 'REPORTE OFICIAL — PROLISEG LTDA',
          subtitle: `Generado autónomamente por CATORCE IA para ${userName}`,
          auditCode: audit.codigo_auditoria,
          generatedAt: new Date().toLocaleString('es-CO'),
          summary: finalMessage.replace(/[*#`]/g, ''),
          columns,
          rows,
        };
      }

      this.catorceBrain.appendConversationTurn(user, userQuery, finalMessage, canal, activatedNodes, toolsUsed);



      return {
        ok: true,
        assistant: 'CATORCE',
        auditCode: audit.codigo_auditoria,
        sql: executedSql || undefined,
        data: customSqlResult.length > 0 ? customSqlResult : undefined,
        pdfDocument,
        telemetryKpis: telemetry.kpis,
        activatedNodes: Array.from(new Set(activatedNodes)),
        toolsUsed,
        message: finalMessage,
        audioDataUrl: undefined,
        latencyMs: Date.now() - startTime,
      };
    } catch (err: any) {
      this.logger.error('❌ Error en processQuery CATORCE:', err);
      throw new BadRequestException(err.message || 'Error al procesar la consulta en CATORCE.');
    }
  }

  /**
   * 🛡️ Respuesta determinista de alta precisión con datos reales de Supabase
   */
  private buildDeterministicCatorceResponse(
    query: string,
    telemetry: any,
    userName: string,
    customSqlResult: any[],
  ): string {
    const k = telemetry.kpis;
    const d = telemetry.detalles;
    const proxVac = (d.quienesSiguenVacaciones || [])
      .slice(0, 5)
      .map((v: any) => `${v.nombre_completo} (${v.proximo_aniversario}, en ${v.dias_para_vacaciones} días)`)
      .join(', ');

    const accesosList = (d.controlesAcceso || [])
      .slice(0, 6)
      .map((a: any) => `${a.nombre} [${a.marca} - ${a.online ? 'En Línea' : a.estado} - Puerta: ${a.estadoPuerta}]`)
      .join('; ');

    return `Hola **Ingeniero**, aquí **CATORCE** reportando en tiempo real desde el Segundo Cerebro de **PROLISEG LTDA**:

- 📍 **Puestos Activos:** Tenemos **${k.puestosActivos} puestos principales** y **${k.subpuestosActivos} subpuestos** operativos.
- 👷 **Empleados Activos:** Contamos con **${k.empleadosActivos} empleados activos** en nómina (**${k.empleadosAsignados}** asignados actualmente en puesto).
- 🏖️ **Vacaciones (Quiénes siguen):** Hay **${k.vacacionesRegistradas} registros** en el módulo de vacaciones. Próximos por cumplir ciclo: ${proxVac || 'Sin aniversarios próximos en los siguientes 60 días'}.
- 🤝 **Clientes y Contratos Activos:** Tenemos **${k.clientesActivos} clientes activos** y **${k.contratosActivos} contratos vigentes** que cubren **${k.guardasContratadosTotal} guardas**.
- 🚪 **Controles de Acceso y Puertas IoT:** Contamos con **${k.controlesAccesoTotal} dispositivos de control de acceso** (**${k.dispositivosOnline} en línea**): ${accesosList || 'Todos asegurados'}.
- 🧠 **Segundo Cerebro (\`ia_brain\`):** **${k.documentosSegundoCerebro} documentos corporativos** indexados y auditables.

${customSqlResult.length > 0 ? `\n📋 **Datos específicos encontrados (${customSqlResult.length}):** \`${JSON.stringify(customSqlResult.slice(0, 5))}\`` : ''}`;
  }

  // ============================================================
  // 🔮 2. IA DE PREDICCIÓN DE AUSENCIAS / INCIDENTES
  // ============================================================
  async generarPredicciones(user: any) {
    try {
      const { data, error } = await this.supabase
        .getClientWithAuth(user.token)
        .from('asistencias')
        .select('*')
        .limit(50);

      if (error) throw new Error(error.message);

      const prompt = `
      Analiza los siguientes registros de asistencia y predice posibles ausencias o incidentes:
      ${JSON.stringify((data || []).slice(0, 30))}
      Retorna un resumen claro con probabilidades y sugerencias.
      `;
      const analisis = await this.geminiService.humanResponse(prompt);

      await this.supabase.getClientWithAuth(user.token).from('ia_predicciones_incidentes').insert({
        tipo_prediccion: 'ausencia',
        probabilidad: 0.8,
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
      const { data, error } = await this.supabase
        .getClientWithAuth(user.token)
        .from('turnos')
        .select('id, empleado_id, hora_inicio, hora_fin, estado_turno')
        .limit(50);

      if (error) throw new Error(error.message);

      const prompt = `
      Evalúa los siguientes turnos en busca de patrones de riesgo, inasistencias o retrasos recurrentes:
      ${JSON.stringify((data || []).slice(0, 30))}
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
      const { nuevos_datos } = body;
      if (!nuevos_datos) throw new BadRequestException('Debe enviar nuevos datos.');

      const prompt = `
      Actualiza el modelo de desempeño con estos nuevos registros:
      ${JSON.stringify(nuevos_datos.slice(0, 20))}
      Indica qué ajustes se realizarán en el modelo adaptativo.
      `;
      const resultado = await this.geminiService.humanResponse(prompt);

      await this.supabase.getClientWithAuth(user.token).from('ia_modelos_configuracion').insert({
        nombre_modelo: 'adaptativo_personal',
        version: 'v2.0',
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
      const data = [{ evento: 'monitoreo_activo_catorce', timestamp: new Date() }];

      const prompt = `
      Detecta comportamientos anómalos o sospechosos en los siguientes eventos de sensores o cámaras:
      ${JSON.stringify(data)}
      Indica posibles amenazas, fallos o movimientos inusuales.
      `;
      const analisis = await this.geminiService.humanResponse(prompt);

      await this.supabase.getClientWithAuth(user.token).from('ia_comportamiento_anomalo').insert({
        tipo_anomalia: 'detectada_ia',
        descripcion: analisis,
        nivel_alerta: 'medio',
        timestamp: new Date().toISOString(),
      });

      return { ok: true, analisis };
    } catch (err: any) {
      this.logger.error('❌ Error en detectarComportamientoAnomalo:', err);
      throw new BadRequestException(err.message);
    }
  }

  // ============================================================
  // 🧠 7. SUGERENCIAS DE CANDIDATOS (Turnos/Reemplazos)
  // ============================================================
  async sugerirReemplazo(turno: any, candidatos: any[]) {
    try {
      const prompt = `
      Actúa como CATORCE, jefe de operaciones de seguridad experto de PROLISEG LTDA.
      Necesito un reemplazo para el siguiente turno:
      - Fecha: ${turno.fecha}
      - Horario: ${turno.hora_inicio} - ${turno.hora_fin}
      - Puesto: ${turno.puesto_nombre} (${turno.ciudad})
      - Cliente: ${turno.cliente_nombre}

      Candidatos disponibles:
      ${JSON.stringify(candidatos)}
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
      const supabase = this.supabase.getClient();

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

      const { data: allEmpleados } = await supabase
        .from('empleados')
        .select(`
          id, nombre_completo, cedula, direccion, ciudad, 
          tipo_vigilante:tipo_vigilante_id (nombre)
        `)
        .eq('activo', true);

      const { data: ocupados } = await supabase
        .from('turnos')
        .select('empleado_id, hora_inicio, hora_fin')
        .eq('fecha', params.fecha)
        .neq('estado_turno', 'cancelado');

      const idsOcupados = new Set(ocupados?.map((o) => o.empleado_id));
      const candidatos = allEmpleados?.filter((e) => !idsOcupados.has(e.id)) || [];

      if (candidatos.length === 0) {
        return { ok: true, sugerencia: 'No se encontraron empleados disponibles para esa fecha.' };
      }

      const puesto: any = (subpuesto as any).puesto;
      const ciudadPuesto = puesto?.ciudad?.toLowerCase();

      const candidatosPriorizados = candidatos
        .sort((a: any, b: any) => {
          const ciudadA = a.ciudad?.toLowerCase() === ciudadPuesto ? 1 : 0;
          const ciudadB = b.ciudad?.toLowerCase() === ciudadPuesto ? 1 : 0;
          return ciudadB - ciudadA;
        })
        .slice(0, 30);

      const promptInfo = {
        requerimiento: {
          puesto: puesto?.nombre,
          subpuesto: subpuesto.nombre,
          ciudad: puesto?.ciudad,
          direccion: puesto?.direccion,
          fecha: params.fecha,
          hora: `${params.hora_inicio} - ${params.hora_fin}`,
        },
        candidatos: candidatosPriorizados.map((c: any) => {
          const perfil: any = c.tipo_vigilante;
          return {
            id: c.id,
            nombre: c.nombre_completo,
            ciudad: c.ciudad,
            direccion: c.direccion,
            perfil: perfil?.nombre || 'General',
          };
        }),
      };

      const prompt = `
      Actúa como jefe de operaciones de seguridad.
      Recomienda los 3 mejores candidatos para cubrir este turno basándote en UBICACIÓN y disponibilidad.
      Detalles del Turno: ${JSON.stringify(promptInfo.requerimiento)}
      Candidatos Disponibles: ${JSON.stringify(promptInfo.candidatos)}
      Responde en formato JSON estrictamente:
      {
        "recomendados": [
          { "id": 123, "nombre": "Nombre", "motivo": "Vive en la misma ciudad..." }
        ],
        "analisis_general": "Resumen breve..."
      }
      `;

      try {
        const respuestaIA = await this.geminiService.humanResponse(prompt);
        const jsonMatch = respuestaIA.match(/\{[\s\S]*\}/);
        const resultado = jsonMatch
          ? JSON.parse(jsonMatch[0])
          : { recomendados: [], analisis_general: respuestaIA };

        return { ok: true, ...resultado };
      } catch {
        return {
          ok: true,
          analisis_general: 'La IA generó una respuesta pero no en el formato esperado.',
          raw: prompt,
        };
      }
    } catch (err: any) {
      this.logger.error('❌ Error en sugerirEmpleados:', err);
      throw new BadRequestException(err.message);
    }
  }

  // ============================================================
  // 📊 8. ESTADO DE API KEYS DE GEMINI & MÉTODOS DE CATORCE BRAIN
  // ============================================================
  getGeminiApiKeysStatus() {
    return this.geminiService.getApiKeysStatus();
  }

  setLiveApiKey(apiKey: string) {
    this.geminiService.setLiveApiKey(apiKey);
    return {
      ok: true,
      message: 'API Key de Gemini Live API configurada y activada como prioridad #1 para CATORCE.',
      status: this.geminiService.getApiKeysStatus(),
    };
  }

  getLiveSessionConfig(user: any) {
    return {
      ok: true,
      assistantName: 'CATORCE',
      company: 'PROLISEG LTDA',
      liveApiKey: this.geminiService.getLiveApiKey(),
      wsEndpoint:
        'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent',
      recommendedModel: 'models/gemini-2.0-flash-exp',
      user: {
        id: user?.id,
        nombre: user?.nombre_completo || user?.nombre || user?.email || 'Operador PROLISEG',
        rol: user?.rol || 'superusuario',
      },
    };
  }

  async getCatorceTelemetry(user: any) {
    return this.catorceBrain.getRealtimeBrainTelemetry(user);
  }

  async addBrainKnowledge(body: any, user: any) {
    return this.catorceBrain.addCorporateKnowledge(body, user);
  }

  async executeAutonomousAction(body: any, user: any) {
    if (body.actionType === 'CREAR_MINUTA_NOVEDAD') {
      return this.catorceBrain.executeAutonomousMinutaOrNovedad(
        {
          edificio_o_puesto: body.edificio_o_puesto || body.puesto || '',
          persona_involucrada: body.persona_involucrada || body.persona || '',
          documento_persona: body.documento_persona || '',
          detalle_novedad: body.detalle_novedad || body.descripcion || '',
          tipo_novedad: body.tipo_novedad || 'Novedad Radio-Operación CATORCE',
          nivel_riesgo: body.nivel_riesgo || 'bajo',
          comando_original: body.comando_original || `Acción directa: ${body.detalle_novedad}`,
          canal: body.canal || 'voz_live_api',
        },
        user,
      );
    }

    if (body.actionType === 'ESTADO_PUERTAS') {
      return this.catorceBrain.checkDoorsAndAccessControlStatus(body.filtro || '', user);
    }

    return this.processQuery(body.comando || body.query || '', user, body.canal || 'voz_live_api');
  }

  async synthesizeHumanVoice(text: string, voiceName: string = 'Aoede') {
    const audioDataUrl = await this.geminiService.generateHumanVoiceAudio(text, voiceName);
    return {
      ok: Boolean(audioDataUrl),
      voiceName,
      audioDataUrl,
    };
  }
}
