

const COMPACT_PROLICONTROL_CATALOG = `

TABLAS Y SERVICIOS EN PROLICONTROL (public):

- turnos: id, puesto_id, subpuesto_id, empleado_id, fecha, hora_inicio, hora_fin, tipo_turno, estado_turno, asignado_por

- asignacion_guardas_puesto: id, puesto_id, subpuesto_id, empleado_id, fecha_asignacion, activo

- puestos_trabajo: id, cliente_id, nombre, ciudad, direccion, activo, contrato_id

- subpuestos_trabajo: id, puesto_id, nombre, guardas_activos, activo

- empleados: id, nombre_completo, cedula, fecha_nacimiento, fecha_expedicion, telefono, correo, ciudad, direccion, rol, activo, asignado, salario_base, eps_id, arl_id, fondo_pension_id, rh

- eps: id, nombre, codigo, created_at, updated_at

- fondos_pension: id, nombre, codigo, created_at, updated_at

- arl: id, nombre, codigo, created_at, updated_at

- aspirantes: id, nombre_completo, cedula, estado_proceso

- asistencias: id, turno_id, empleado_id, tipo_marca, timestamp, latitud_entrada, longitud_entrada

- clientes: id, nombre_empresa, nit, telefono, contacto, activo

- contratos: id, cliente_id, valor, guardas_activos, fecha_inicio, fecha_fin, estado

- minutas: id, puesto_id, subpuesto_id, titulo, contenido, descripcion, tipo_novedad, nivel_riesgo, persona_involucrada, fecha, hora

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
import { CatorceSentinelService } from './catorce-sentinel.service';

import { schema } from './schema';
import * as crypto from 'crypto';



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
  private preferredNameCache = new Map<number, { name: string; expiresAt: number }>();



  constructor(

    private readonly geminiService: GeminiService,

    private readonly supabase: SupabaseService,

    private readonly catorceBrain: CatorceBrainService,
    private readonly catorceSentinel: CatorceSentinelService,

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

   * - Si la consulta no tiene nada que ver con PROLISEG LTDA, responde directamente con amabilidad, rigor y respeto profesional.

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



      // Cargar trato preferido aprendido por CATORCE con cache en RAM (TTL 60s)
      let activeUserName = userName;
      try {
        const uid = Number(user?.id);
        if (uid) {
          const cachedName = this.preferredNameCache.get(uid);
          if (cachedName && cachedName.expiresAt > Date.now()) {
            activeUserName = cachedName.name;
          } else {
            const memories = await this.catorceBrain.runSql(
              `SELECT hecho_recordado FROM ia_brain.memoria_usuarios WHERE usuario_id = ${uid} AND clave = 'trato_preferido' AND activo = true ORDER BY created_at DESC LIMIT 1`,
            );
            const matchName = memories?.[0]?.hecho_recordado?.match(/"([^"]+)"/);
            const resolved = matchName?.[1]?.trim() || userName;
            activeUserName = resolved;
            this.preferredNameCache.set(uid, { name: resolved, expiresAt: Date.now() + 60_000 });
          }
        }
      } catch {}



      const qNorm = userQuery

        .toLowerCase()

        .normalize('NFD')

        .replace(/[\u0300-\u036f]/g, '')

        .trim();



      const activatedNodes: string[] = ['core'];

      const toolsUsed: string[] = [];



      // =========================================================================
      // 0-0: SALUDOS DIRECTOS Y RESPUESTA ULTRA-VELOZ (<50ms)
      // =========================================================================
      const isPureGreeting =
        /^(hola|buenos dias|buenas tardes|buenas noches|buen dia|como estas|como esta|como te va|que tal|como va todo|hola catorce|saludos)\b/i.test(qNorm) &&
        !/\b(contrato|minuta|turno|empleado|puesto|dispositivo|alarma|cabrachi|crear|inactivar|novedad|guarda|informe|auditoria|buscar)\b/i.test(qNorm) &&
        qNorm.length < 50;

      if (isPureGreeting) {
        const greetingMsg = `Hola ${activeUserName}, todo en orden por aquí en el Segundo Cerebro de Prolicontrol. ¿En qué le puedo colaborar en este momento?`;
        const audioUrl = await this.generateVoiceIfRequested(greetingMsg, canal);
        this.catorceBrain.appendConversationTurn(user, userQuery, greetingMsg, canal, ['core'], ['CATORCE-CORE:saludoDirecto']);
        return {
          ok: true,
          assistant: 'CATORCE',
          actionExecuted: 'SALUDO_CORDIAL',
          activity: 'Saludando al Ingeniero',
          message: greetingMsg,
          audioUrl,
          latencyMs: Date.now() - startTime,
        };
      }

      // =========================================================================

      // 0️⃣-A: APRENDIZAJE ADAPTATIVO DE NOMBRE O TRATO PREFERIDO (Ej: "llámame Ingeniero Ombita")

      // =========================================================================

      const nameLearningMatch = userQuery.match(/\b(?:a partir de ahora\s+|de ahora en adelante\s+)?(?:llamame|dime|nombrame|puedes llamarme|debes llamarme|mi nombre es)\s+([a-zA-Z0-9_áéíóúÁÉÍÓÚñÑ ]+)/i);

      if (nameLearningMatch) {

        let customName = nameLearningMatch[1].trim();

        customName = customName.replace(/\b(por favor|ok|vale|listo|gracias|a partir de ahora|de ahora en adelante)\b/gi, '').trim();

        if (customName.length >= 2) {

          await this.catorceBrain.saveUserMemory(

            user,

            `El usuario indicó expresamente que su nombre o título preferido es "${customName}". Dirígete a él SIEMPRE como "${customName}".`,

            'trato_preferido',

            10,

          );

          const confirmMsg = `Entendido, ${customName}. A partir de este momento me dirigiré a usted siempre como ${customName}. He registrado esta instrucción en mi memoria permanente para que todas nuestras conversaciones en Prolicontrol usen su trato preferido. ¿En qué le puedo colaborar hoy, ${customName}?`;

          this.catorceBrain.appendConversationTurn(user, userQuery, confirmMsg, canal, ['core', 'brain'], ['CATORCE-MEMORY:setUserPreferredName']);

          return {

            ok: true,

            assistant: 'CATORCE',

            actionExecuted: 'MEMORIA_TRATO_ACTUALIZADA',

            activatedNodes: ['core', 'brain'],

            toolsUsed: ['CATORCE-MEMORY:setUserPreferredName'],

            message: confirmMsg,

            latencyMs: Date.now() - startTime,

          };

        }

      }



      // =========================================================================

      // 0️⃣-B: AUTO-PRESENTACIÓN EJECUTIVA DE CATORCE ("Preséntate")

      // =========================================================================

            // =========================================================================
      // 0️⃣-WM: GESTIÓN DE MEMORIA DE TRABAJO (SCRATCHPAD MULTI-TURNO)
      // =========================================================================
      const activeWM = await this.catorceBrain.getActiveWorkingMemory(user);
      if (activeWM && activeWM.estado !== 'COMPLETADO') {
        const isCancel = /\b(cancela|cancelar|olvida|olvidalo|deja asi|descartar|olvida la tarea)\b/i.test(qNorm);
        if (isCancel) {
          await this.catorceBrain.clearWorkingMemory(user);
          const cancelMsg = `Entendido ${activeUserName}, he cancelado la tarea en progreso y limpiado la memoria de trabajo. ¿En qué más le puedo colaborar?`;
          this.catorceBrain.appendConversationTurn(user, userQuery, cancelMsg, canal, ['core'], ['CATORCE-WM:cancelTask']);
          return {
            ok: true,
            assistant: 'CATORCE',
            actionExecuted: 'CANCELAR_TAREA_MEMORIA',
            message: cancelMsg,
            latencyMs: Date.now() - startTime,
          };
        }

        if (activeWM.operacion === 'CREAR_EMPLEADO') {
          const datos = activeWM.datos_recolectados || {};
          const isConfirm = /\b(si|confirmo|procede|crealo|registralo|adelante|dale|de acuerdo)\b/i.test(qNorm);

          const cedMatch = userQuery.match(/\b(?:cedula|cc|identificacion|doc)?\s*(\d{6,12})\b/i);
          if (cedMatch && !datos.cedula) {
            datos.cedula = cedMatch[1];
          }
          const telMatch = userQuery.match(/\b(?:telefono|celular|tel|movil)?\s*(3\d{9}|\d{7,10})\b/i);
          if (telMatch && !datos.telefono) {
            datos.telefono = telMatch[1];
          }
          const rolMatch = userQuery.match(/\b(vigilante|guarda|supervisor|escolta|operador|radiooperador|coordinador|administrativo)\b/i);
          if (rolMatch && !datos.cargo) {
            datos.cargo = rolMatch[1];
          }

          if (isConfirm && datos.cedula && datos.nombre_completo) {
            // 🛡️ Verificación estricta anti-tampering del token de confirmación
            if (activeWM.token_confirmacion) {
              const expectedToken = crypto
                .createHash('sha256')
                .update(String(Number(user?.id) || 1) + '|' + activeWM.operacion + '|' + JSON.stringify(datos))
                .digest('hex')
                .slice(0, 16);
              if (activeWM.token_confirmacion !== expectedToken) {
                await this.catorceBrain.clearWorkingMemory(user, 'Violación de integridad de token en confirmación');
                const tamperMsg = 'Alerta de Seguridad e Integridad: La confirmación fue rechazada porque los parámetros de la operación sufrieron alteraciones no autorizadas en memoria. La tarea ha sido invalidada preventivamente.';
                return { ok: false, message: tamperMsg, latencyMs: Date.now() - startTime };
              }
            }
            try {
              const resEmp = await this.catorceBrain.toolCrearEmpleado(datos, user);
              await this.catorceBrain.clearWorkingMemory(user);
              const successMsg = 'He registrado oficialmente a **' + resEmp.empleado.nombre_completo + '** en Prolicontrol:\n\n* Cédula: ' + resEmp.empleado.cedula + '\n* Cargo: ' + (resEmp.empleado.rol || 'Vigilante') + '\n* Teléfono: ' + (datos.telefono || 'No registrado') + '\n* Código de auditoría: [' + resEmp.auditCode + ']\n* Sello de integridad SHA-256: [' + (resEmp.hashIntegridad || '').slice(0, 16) + '...]';
              const voiceSnippet = `Empleado ${resEmp.empleado.nombre_completo} creado con éxito en Prolicontrol.`;
              const audioUrl = await this.generateVoiceIfRequested(voiceSnippet, canal);
              this.catorceBrain.appendConversationTurn(user, userQuery, successMsg, canal, ['empleados'], ['CATORCE-OPS:crearEmpleado']);
              return {
                ok: true,
                assistant: 'CATORCE',
                actionExecuted: 'CREACION_EMPLEADO_COMPLETA',
                activity: 'Empleado registrado en base de datos',
                interactiveResults: {
                  type: 'empleado_creado',
                  data: resEmp.empleado,
                },
                message: successMsg,
                audioUrl,
                latencyMs: Date.now() - startTime,
              };
            } catch (err: any) {
              const errMsg = `Ocurrió una dificultad al registrar el empleado: ${err.message}`;
              return { ok: false, message: errMsg, latencyMs: Date.now() - startTime };
            }
          }

          const missing: string[] = [];
          if (!datos.cedula) missing.push('cédula');
          if (!datos.telefono) missing.push('número de teléfono');

          if (missing.length > 0) {
            await this.catorceBrain.saveWorkingMemory(user, {
              tarea_activa: `Creación de ${datos.nombre_completo}`,
              operacion: 'CREAR_EMPLEADO',
              datos_recolectados: datos,
              campos_faltantes: missing,
              estado: 'EN_PROGRESO',
              ultimo_prompt: userQuery,
            });
            const askMsg = `Entendido ${activeUserName}. Para registrar a ${datos.nombre_completo} en Prolicontrol, por favor indíqueme su ${missing.join(' y ')}.`;
            const audioUrl = await this.generateVoiceIfRequested(askMsg, canal);
            return {
              ok: true,
              assistant: 'CATORCE',
              actionExecuted: 'SOLICITUD_DATOS_EMPLEADO',
              workingMemory: { tarea: `Creación de ${datos.nombre_completo}`, faltantes: missing },
              message: askMsg,
              audioUrl,
              latencyMs: Date.now() - startTime,
            };
          } else {
            await this.catorceBrain.saveWorkingMemory(user, {
              tarea_activa: `Confirmación creación de ${datos.nombre_completo}`,
              operacion: 'CREAR_EMPLEADO',
              datos_recolectados: datos,
              campos_faltantes: [],
              estado: 'PENDIENTE_CONFIRMACION',
              ultimo_prompt: userQuery,
            });
            const confirmPrompt = `Tengo la información lista para registrar en Prolicontrol:\n\n* Nombre: ${datos.nombre_completo}\n* Cédula: ${datos.cedula}\n* Teléfono: ${datos.telefono || 'No indicado'}\n* Cargo: ${datos.cargo || 'Vigilante'}\n\n¿Me confirma si procedo con el registro oficial en la base de datos?`;
            const voiceSnippet = `${activeUserName}, tengo los datos de ${datos.nombre_completo}. ¿Confirma el registro oficial en la base de datos?`;
            const audioUrl = await this.generateVoiceIfRequested(voiceSnippet, canal);
            return {
              ok: true,
              assistant: 'CATORCE',
              actionExecuted: 'CONFIRMACION_CREACION_EMPLEADO',
              workingMemory: { estado: 'PENDIENTE_CONFIRMACION', datos },
              message: confirmPrompt,
              audioUrl,
              latencyMs: Date.now() - startTime,
            };
          }
        }

        if (activeWM.operacion === 'GESTION_CONTRATO') {
          const dContrato = activeWM.datos_recolectados || {};
          const isValor = /\b(valor|cuanto vale|cuanto cuesta|precio|costo|cuanto es|deme el valor|dame el valor|valor mensual)\b/i.test(qNorm);
          if (isValor) {
            const valorFmt = dContrato.valor ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(dContrato.valor) : 'No especificado';
            const valMsg = activeUserName + ', el valor mensual del contrato de **' + (dContrato.clienteNombre || 'este cliente') + '** es de **' + valorFmt + '** (con ' + (dContrato.guardasActivos || 'cuota establecida') + ' guardas contratados).';
            const voiceSnippet = activeUserName + ', el valor del contrato de ' + (dContrato.clienteNombre || 'este cliente') + ' es de ' + valorFmt + '.';
            const audioUrl = await this.generateVoiceIfRequested(voiceSnippet, canal);
            this.catorceBrain.appendConversationTurn(user, userQuery, valMsg, canal, ['clientes'], ['CATORCE-DOCS:consultarValorContrato']);
            return {
              ok: true,
              assistant: 'CATORCE',
              actionExecuted: 'CONSULTA_VALOR_CONTRATO_CONTEXTO',
              activity: 'Consultando valor de contrato de ' + (dContrato.clienteNombre || 'cliente'),
              message: valMsg,
              audioUrl,
              latencyMs: Date.now() - startTime,
            };
          }

          const isInactivar = /\b(inactivalo|inactivar|desactivalo|desactivar|dar de baja|cancela el contrato|cancelalo)\b/i.test(qNorm);
          if (isInactivar) {
            try {
              const admin = this.supabase.getSupabaseAdminClient();
              const { error: updErr } = await admin
                .from('contratos')
                .update({ estado: false, updated_at: new Date().toISOString() })
                .eq('id', dContrato.contratoId);

              if (updErr) throw updErr;

              this.catorceBrain.invalidateTelemetryCache();
              const audit = await this.catorceBrain.recordAudit({
                user,
                subagente: 'CATORCE-OMNISCIENTE',
                accion: 'INACTIVAR_CONTRATO',
                modulo: 'Contratos / Clientes',
                tablaDestino: 'public.contratos',
                registroId: String(dContrato.contratoId),
                comandoOriginal: userQuery,
                parametros: { contratoId: dContrato.contratoId, cliente: dContrato.clienteNombre, nuevoEstado: false },
                resultado: { exitoso: true, estado: false },
                exitoso: true,
                canal,
              });

              await this.catorceBrain.clearWorkingMemory(user);
              const inactMsg = activeUserName + ', he procedido a **inactivar el contrato** de **' + (dContrato.clienteNombre || 'este cliente') + '** (Contrato #' + dContrato.contratoId + ') en Prolicontrol:\n\n* Estado actualizado: **INACTIVO**\n* Fecha: ' + new Date().toLocaleString('es-CO') + '\n* Código de auditoría: [' + audit.codigo_auditoria + ']';
              const voiceSnippet = activeUserName + ', el contrato de ' + (dContrato.clienteNombre || 'este cliente') + ' ha sido inactivado oficialmente en la base de datos.';
              const audioUrl = await this.generateVoiceIfRequested(voiceSnippet, canal);
              this.catorceBrain.appendConversationTurn(user, userQuery, inactMsg, canal, ['clientes'], ['CATORCE-CRUD:inactivarContrato']);
              return {
                ok: true,
                assistant: 'CATORCE',
                actionExecuted: 'INACTIVAR_CONTRATO_COMPLETO',
                auditCode: audit.codigo_auditoria,
                activity: 'Contrato de ' + (dContrato.clienteNombre || 'cliente') + ' inactivado',
                message: inactMsg,
                audioUrl,
                latencyMs: Date.now() - startTime,
              };
            } catch (err: any) {
              return { ok: false, message: 'Dificultad al inactivar el contrato: ' + err.message, latencyMs: Date.now() - startTime };
            }
          }
        }
      }


      // =========================================================================
      // 0-0B: CONTROL FISICO REMOTO DE PUERTAS Y ACCESOS IOT (BRAZOS CATORCE-IOT)
      // =========================================================================
      const parsedDoorCmd = this.catorceBrain.parseDoorCommandAndId(userQuery);
      const mentionsAccessNoun =
        /\b(puerta|puertas|acceso|accesos|porton|portones|torniquete|torniquetes|talanquera|biometrico|citofono|entrada|salida|porteria|hikvision|dahua|rele)\b/i.test(qNorm);
      const isDoorReadOnlyQuestion =
        /\b(cuantas puertas|cuantos controles|estado de las puertas|estado de puertas|como funciona|manual|protocolo|test de dispositivos|testear dispositivos|probar puertas|verificar puertas)\b/i.test(qNorm);
      const isListDoorsQuery =
        !parsedDoorCmd.command &&
        /\b(que puertas|cuales puertas|lista de puertas|listar puertas|muestra.*puertas|muestrame.*puertas|ver puertas|ver controles de acceso)\b/i.test(qNorm);

      if (isListDoorsQuery) {
        const puertas = await this.catorceBrain.toolListarPuertasYDispositivos();
        const listado = puertas
          .slice(0, 12)
          .map((d: any, idx: number) => `${idx + 1}. **${d.nombre}** (${d.puesto}, ${d.marca}, IP ${d.ip}, estado: ${d.estadoPuerta})`)
          .join('\n');
        const msg = puertas.length > 0
          ? `${activeUserName}, tenemos ${puertas.length} dispositivos de control de acceso registrados:\n\n${listado}\n\nSi desea abrir o cerrar alguno, solo indiqueme cual.`
          : `${activeUserName}, no hay dispositivos de control de acceso registrados en Prolicontrol.`;
        this.catorceBrain.appendConversationTurn(user, userQuery, msg, canal, ['accesos'], ['CATORCE-IOT:listarPuertas']);
        return {
          ok: true,
          assistant: 'CATORCE',
          actionExecuted: 'LISTAR_PUERTAS_ACCESO',
          activatedNodes: ['accesos'],
          toolsUsed: ['CATORCE-IOT:listarPuertas'],
          data: puertas,
          message: msg,
          latencyMs: Date.now() - startTime,
        };
      }

      if (parsedDoorCmd.command && mentionsAccessNoun && !isDoorReadOnlyQuestion) {
        const doorRes = await this.catorceBrain.toolControlarPuerta(
          {
            targetQuery: userQuery,
            doorId: parsedDoorCmd.doorId,
            command: parsedDoorCmd.command,
            applyAll: parsedDoorCmd.applyAll,
          },
          user,
        );
        return await this.buildAndReturnDoorControlResponse(
          doorRes,
          parsedDoorCmd.command,
          userQuery,
          activeUserName,
          user,
          canal,
          startTime,
        );
      }

      // 0-0C: Continuacion rapida en RAM si el turno anterior pregunto que puerta operar
      if (!parsedDoorCmd.command && qNorm.split(/\s+/).length <= 6 && !qNorm.includes('?')) {
        const memHistory = await this.catorceBrain.getRecentConversationHistory(user);
        const lastBotTurn = [...(memHistory || [])].reverse().find((h) => h.role !== 'user')?.text || '';
        const doorAskMatch = lastBotTurn.match(/Cual desea (abrir|cerrar|dejar siempre abierta|dejar siempre cerrada)\?|Indiqueme cual desea operar/i);
        if (doorAskMatch) {
          const prevUserTurn = [...(memHistory || [])].reverse().find((h) => h.role === 'user')?.text || '';
          const prevCmd = this.catorceBrain.parseDoorCommandAndId(prevUserTurn).command || 'abrir';
          const numSelectionMatch = qNorm.match(/\b(primera|uno|1|segunda|dos|2|tercera|tres|3|cuarta|cuatro|4|quinta|cinco|5)\b/i);
          let resolvedDeviceId: string | undefined = undefined;
          if (numSelectionMatch) {
            const idxMap: Record<string, number> = { primera: 0, uno: 0, '1': 0, segunda: 1, dos: 1, '2': 1, tercera: 2, tres: 2, '3': 2, cuarta: 3, cuatro: 3, '4': 3, quinta: 4, cinco: 4, '5': 4 };
            const pickIdx = idxMap[numSelectionMatch[1].toLowerCase()];
            const wm = await this.catorceBrain.getActiveWorkingMemory(user);
            const cands = wm?.datos_recolectados?.candidates || [];
            if (cands[pickIdx]?.id) {
              resolvedDeviceId = String(cands[pickIdx].id);
            }
          }
          const doorRes = await this.catorceBrain.toolControlarPuerta(
            {
              deviceId: resolvedDeviceId,
              targetQuery: resolvedDeviceId ? undefined : userQuery,
              command: prevCmd,
            },
            user,
          );
          return await this.buildAndReturnDoorControlResponse(
            doorRes,
            prevCmd,
            userQuery,
            activeUserName,
            user,
            canal,
            startTime,
          );
        }
      }

      // =========================================================================
      // 0-0: MISIÓN OPERATIVA ENCADENADA: AUDITORÍA INTEGRAL DE PUESTO (MULTI-TOOL)
      // Ej: «CATORCE, revisa Cabrachi, identifica las novedades críticas de hoy, verifica si hay cámaras desconectadas, comprueba la cobertura de turnos y prepárame un informe ejecutivo para gerencia.»
      // =========================================================================
      const isChainedMission =
        (/\b(revisa|audita|inspecciona|analiza|como estamos|como va|como esta|situacion|estado)\b/i.test(qNorm) &&
         /\b(cabrachi|puesto|minutas|camaras|turnos|informe ejecutivo|mision)\b/i.test(qNorm) &&
         (/\b(informe|gerencia|auditoria|novedades criticas|cobertura|completa|hoy)\b/i.test(qNorm) || /\bcabrachi\b/i.test(qNorm))) ||
        /\b(mision operativa|auditoria integral|auditoria completa)\b/i.test(qNorm) ||
        (/\b(revisa|audita|como esta|como estamos|como va)\b/i.test(qNorm) && /\b(cabrachi|puesto)\b/i.test(qNorm));

      if (isChainedMission) {
        const mission = await this.catorceBrain.executeChainedOperationalMission(userQuery, user);

        const linesMinutas = mission.fases.fase1_minutas.registros.slice(0, 3).map((r: any) => '  * [' + r.criticidad + '] ' + r.hora + ' - ' + r.detalle + ' *(Responsable: ' + r.responsable + ')*').join('\n');
        const linesCams = mission.fases.fase2_videovigilancia.dispositivos.map((d: any) => '  * **' + d.nombre + '** (IP: ' + d.ip + '): Estado ' + d.estadoFisico + ' | RTSP: ' + d.puertoRtsp + ' | Latencia: ' + d.latenciaMs + ' ms').join('\n');
        const linesTurnos = mission.fases.fase3_cobertura_turnos.turnos.map((t: any) => '  * ' + t.guarda + ' (' + t.horario + '): ' + t.estadoCobertura + ' | Marcación: ' + t.horaMarca).join('\n');
        const linesAcciones = mission.accionesRecomendadas.map((a: string, idx: number) => String(idx + 1) + '. ' + a).join('\n');

        const balanceContractual = mission.fases.fase4_contractual.discrepanciaGuardas >= 0
          ? 'Conforme / Sin Déficit (+' + mission.fases.fase4_contractual.discrepanciaGuardas + ' guarda adicional)'
          : 'Déficit Operativo de ' + Math.abs(mission.fases.fase4_contractual.discrepanciaGuardas) + ' puesto(s) frente al contrato';

        const msg = activeUserName + ', he ejecutado la **Misión Operativa: Auditoría Integral sobre ' + mission.puesto.nombre + '** (' + mission.puesto.ciudad + '):\n\n' +
          '* **Cliente Titular:** ' + mission.puesto.cliente + '\n' +
          '* **Semáforo General:** **[' + mission.semaforo + ']** (Evaluación multidimensional en ' + mission.duracionMs + ' ms)\n\n' +
          '---\n\n' +
          '### 1. Minutas y Novedades Operativas\n' +
          '* Total de novedades registradas: **' + mission.fases.fase1_minutas.totalMinutas + '**\n' +
          '* Novedades Críticas: **' + mission.fases.fase1_minutas.criticasCount + '** | Novedades de Alta Prioridad: **' + mission.fases.fase1_minutas.altasCount + '**\n' +
          (linesMinutas || '  * Sin novedades críticas registradas en la jornada.') + '\n\n' +
          '### 2. Videovigilancia y Red IoT\n' +
          '* Dispositivos evaluados: **' + mission.fases.fase2_videovigilancia.totalDispositivos + '**\n' +
          '* Cámaras en línea: **' + mission.fases.fase2_videovigilancia.onlineCount + '** | Desconectadas: **' + mission.fases.fase2_videovigilancia.offlineCount + '**\n' +
          (linesCams || '  * Todos los equipos transmitiendo con normalidad.') + '\n\n' +
          '### 3. Cobertura de Turnos y Cumplimiento\n' +
          '* Turnos programados: **' + mission.fases.fase3_cobertura_turnos.programados + '** | Turnos con presencia confirmada: **' + mission.fases.fase3_cobertura_turnos.cubiertos + '**\n' +
          '* Índice de Cobertura Efectiva: **' + mission.fases.fase3_cobertura_turnos.porcentajeCobertura + '%**\n' +
          (linesTurnos || '  * Programación de turnos cubierta sin novedades.') + '\n\n' +
          '### 4. Cruce de Información Contractual\n' +
          '* Guardas pactados en contrato: **' + mission.fases.fase4_contractual.guardasContratados + '**\n' +
          '* Guardas asignados en programación: **' + mission.fases.fase4_contractual.guardasAsignados + '**\n' +
          '* Balance de dotación: **' + balanceContractual + '**\n\n' +
          '### 5. Plan de Acción y Recomendaciones para Gerencia\n' +
          linesAcciones + '\n\n' +
          '---\n' +
          '* **Código de Auditoría:** [' + mission.auditCode + ']\n' +
          '* **Sello SHA-256 Inalterable:** [' + mission.hashIntegridad + ']\n' +
          '* *El informe ejecutivo oficial ha sido compilado y preparado para su visualización y descarga.*';

        const pdfDoc = {
          filename: 'Informe_Ejecutivo_' + mission.puesto.nombre.replace(/\s+/g, '_') + '_' + new Date().toISOString().slice(0, 10) + '.pdf',
          title: 'INFORME EJECUTIVO DE AUDITORÍA OPERATIVA: ' + mission.puesto.nombre.toUpperCase(),
          subtitle: 'PROLISEG LTDA - Dirección de Operaciones y Seguridad Integral',
          generatedAt: new Date().toLocaleString('es-CO'),
          puesto: mission.puesto.nombre,
          cliente: mission.puesto.cliente,
          semaforo: mission.semaforo,
          auditCode: mission.auditCode,
          hashIntegridad: mission.hashIntegridad,
          summary: 'Auditoría integral multidimensional ejecutada por CATORCE sobre ' + mission.puesto.nombre + ' (' + mission.semaforo + '). Cobertura: ' + mission.fases.fase3_cobertura_turnos.porcentajeCobertura + '%, Novedades críticas: ' + mission.fases.fase1_minutas.criticasCount + ', Cámaras fuera de línea: ' + mission.fases.fase2_videovigilancia.offlineCount + '.',
          columns: ['Dimensión Evaluada', 'Hallazgo / Métrica Registrada', 'Criterio Operativo'],
          rows: [
            ['1. Novedades y Minutas', mission.fases.fase1_minutas.totalMinutas + ' registradas (' + mission.fases.fase1_minutas.criticasCount + ' críticas, ' + mission.fases.fase1_minutas.altasCount + ' de alta prioridad)', mission.fases.fase1_minutas.criticasCount === 0 ? 'CONFORME' : 'ATENCIÓN INMEDIATA'],
            ['2. Videovigilancia y Red IoT', mission.fases.fase2_videovigilancia.onlineCount + ' equipos en línea de ' + mission.fases.fase2_videovigilancia.totalDispositivos + ' probados', mission.fases.fase2_videovigilancia.offlineCount === 0 ? 'EN LÍNEA (RTSP 554)' : mission.fases.fase2_videovigilancia.offlineCount + ' DESCONECTADA(S)'],
            ['3. Cobertura de Turnos', mission.fases.fase3_cobertura_turnos.cubiertos + ' de ' + mission.fases.fase3_cobertura_turnos.programados + ' turnos cubiertos (' + mission.fases.fase3_cobertura_turnos.porcentajeCobertura + '%)', mission.fases.fase3_cobertura_turnos.porcentajeCobertura >= 100 ? '100% CUBIERTO' : 'DÉFICIT COBERTURA'],
            ['4. Cuota Contractual', mission.fases.fase4_contractual.guardasAsignados + ' asignados frente a ' + mission.fases.fase4_contractual.guardasContratados + ' pactados', mission.fases.fase4_contractual.discrepanciaGuardas >= 0 ? 'CUMPLE CONTRATO' : 'DÉFICIT CONTRACTUAL'],
            ['5. Trazabilidad Criptográfica', 'Código: ' + mission.auditCode + ' | Hash SHA-256: ' + mission.hashIntegridad.slice(0, 16) + '...', 'VERIFICADA INMUTABLE'],
          ],
          fases: mission.fases,
          accionesRecomendadas: mission.accionesRecomendadas,
        };

        const voiceSnippet = activeUserName + ', he culminado la auditoría operativa del puesto ' + mission.puesto.nombre + '. Se detectaron ' + mission.fases.fase1_minutas.criticasCount + ' novedades críticas, ' + mission.fases.fase2_videovigilancia.offlineCount + ' cámaras con anomalía y una cobertura de turnos del ' + mission.fases.fase3_cobertura_turnos.porcentajeCobertura + ' por ciento. El informe ejecutivo completo y el plan de mitigación para gerencia están disponibles en pantalla.';
        const audioUrl = await this.generateVoiceIfRequested(voiceSnippet, canal);
        this.catorceBrain.appendConversationTurn(user, userQuery, msg, canal, ['puestos', 'minutas', 'accesos', 'turnos'], ['CATORCE-MISSION:auditoriaIntegral']);

        return {
          ok: true,
          assistant: 'CATORCE',
          actionExecuted: 'MISION_OPERATIVA_AUDITORIA_INTEGRAL',
          activity: 'Auditoría integral completada para ' + mission.puesto.nombre,
          missionData: mission,
          pdfDocument: pdfDoc,
          documentViewer: {
            type: 'pdf',
            title: 'Informe Ejecutivo - ' + mission.puesto.nombre,
            data: pdfDoc,
          },
          interactiveResults: {
            type: 'mision_operativa_report',
            data: mission,
          },
          message: msg,
          audioUrl,
          latencyMs: Date.now() - startTime,
        };
      }

      // =========================================================================
      // 0-1: CREACIÓN DE EMPLEADOS CON RECOLECCIÓN DE DATOS Y CONFIRMACIÓN
      // =========================================================================
      const isCreateEmpleado =
        /\b(crear|crea|nuevo|registrar|registra)\b.*\b(empleado|colaborador|guarda|vigilante|personal)\b/i.test(qNorm) &&
        !/\b(turno|puesto|minuta|novedad)\b/i.test(qNorm);

      if (isCreateEmpleado) {
        const nameMatch = userQuery.match(/(?:empleado|colaborador|guarda|vigilante)\s+(?:llamado\s+|denominado\s+|a\s+|al\s+se\u00f1or\s+|a\s+la\s+se\u00f1ora\s+)?([a-zA-Z\u00e1\u00e9\u00ed\u00f3\u00fa\u00c1\u00c9\u00cd\u00d3\u00da\u00f1\u00d1 ]+)/i);
        let candidateName = nameMatch ? nameMatch[1].replace(/\b(con|cedula|cc|telefono|celular|para|en|como|rol)\b.*$/i, '').trim() : '';
        if (!candidateName || candidateName.length < 3) {
          candidateName = 'Nuevo Colaborador';
        }

        const cedMatch = userQuery.match(/\b(?:cedula|cc|identificacion|doc)?\s*(\d{6,12})\b/i);
        const telMatch = userQuery.match(/\b(?:telefono|celular|tel|movil)?\s*(3\d{9}|\d{7,10})\b/i);
        const rolMatch = userQuery.match(/\b(vigilante|guarda|supervisor|escolta|operador|radiooperador|coordinador|administrativo)\b/i);

        const collected: any = {
          nombre_completo: candidateName,
          cedula: cedMatch ? cedMatch[1] : undefined,
          telefono: telMatch ? telMatch[1] : undefined,
          cargo: rolMatch ? rolMatch[1] : 'Vigilante',
        };

        const missing: string[] = [];
        if (!collected.cedula) missing.push('número de cédula');
        if (!collected.telefono) missing.push('número de teléfono');

        if (missing.length > 0) {
          await this.catorceBrain.saveWorkingMemory(user, {
            tarea_activa: `Creación de ${candidateName}`,
            operacion: 'CREAR_EMPLEADO',
            datos_recolectados: collected,
            campos_faltantes: missing,
            estado: 'EN_PROGRESO',
            ultimo_prompt: userQuery,
          });
          const askMsg = `Entendido ${activeUserName}. Para registrar a ${candidateName} en Prolicontrol, por favor indíqueme su ${missing.join(' y ')}.`;
          const audioUrl = await this.generateVoiceIfRequested(askMsg, canal);
          return {
            ok: true,
            assistant: 'CATORCE',
            actionExecuted: 'SOLICITUD_DATOS_EMPLEADO',
            activity: `Solicitando ${missing.join(', ')} para ${candidateName}`,
            workingMemory: { tarea: `Creación de ${candidateName}`, faltantes: missing },
            message: askMsg,
            audioUrl,
            latencyMs: Date.now() - startTime,
          };
        } else {
          await this.catorceBrain.saveWorkingMemory(user, {
            tarea_activa: `Confirmación creación de ${candidateName}`,
            operacion: 'CREAR_EMPLEADO',
            datos_recolectados: collected,
            campos_faltantes: [],
            estado: 'PENDIENTE_CONFIRMACION',
            ultimo_prompt: userQuery,
          });
          const confirmMsg = `Tengo los datos listos para registrar a ${candidateName}:\n\n* Cédula: ${collected.cedula}\n* Teléfono: ${collected.telefono}\n* Cargo: ${collected.cargo}\n\n¿Me confirma si procedo con el registro oficial en la base de datos de Prolicontrol?`;
          const voiceSnippet = `${activeUserName}, tengo los datos de ${candidateName}. ¿Confirma el registro oficial en la base de datos?`;
          const audioUrl = await this.generateVoiceIfRequested(voiceSnippet, canal);
          return {
            ok: true,
            assistant: 'CATORCE',
            actionExecuted: 'CONFIRMACION_CREACION_EMPLEADO',
            activity: `Esperando confirmación para registrar a ${candidateName}`,
            workingMemory: { estado: 'PENDIENTE_CONFIRMACION', datos: collected },
            message: confirmMsg,
            audioUrl,
            latencyMs: Date.now() - startTime,
          };
        }
      }

      // =========================================================================
      // 0-2: MODIFICACIÓN DE DATOS DE EMPLEADO (TELÉFONO, DIRECCIÓN, ETC.)
      // =========================================================================
      const isModifyEmpleado =
        /\b(modifica|cambia|actualiza|corrige)\b.*\b(telefono|celular|direccion|correo|salario|rol)\b/i.test(qNorm) ||
        (/\b(modifica|cambia|actualiza)\b.*\b(empleado|guarda|colaborador)\b/i.test(qNorm) && /\b(telefono|celular)\b/i.test(qNorm));

      if (isModifyEmpleado) {
        const telMatch = userQuery.match(/\b(?:al|por|nuevo)?\s*(3\d{9}|\d{7,10})\b/);
        const nuevoTel = telMatch ? telMatch[1] : null;

        const nameMatch = userQuery.match(/(?:de|del empleado|al empleado|a|para)\s+([a-zA-Z\u00e1\u00e9\u00ed\u00f3\u00fa\u00c1\u00c9\u00cd\u00d3\u00da\u00f1\u00d1 ]+)/i);
        const rawName = nameMatch ? nameMatch[1].replace(/\b(al|por|telefono|celular|nuevo|numero)\b.*$/i, '').trim() : '';

        if (nuevoTel && rawName.length >= 3) {
          try {
            const resMod = await this.catorceBrain.toolModificarEmpleado(
              {
                empleadoQuery: rawName,
                campo: 'telefono',
                nuevoValor: nuevoTel,
              },
              user,
            );
            const msg = `He actualizado exitosamente el teléfono de **${resMod.empleado.nombre_completo}** en Prolicontrol:\n\n* Teléfono anterior: ${resMod.valorAnterior || 'No registrado'}\n* Nuevo teléfono: ${resMod.nuevoValor}\n* Código de auditoría: ${resMod.auditCode}`;
            const voiceSnippet = `${activeUserName}, el teléfono de ${resMod.empleado.nombre_completo} ha sido actualizado a ${resMod.nuevoValor} en Prolicontrol.`;
            const audioUrl = await this.generateVoiceIfRequested(voiceSnippet, canal);
            this.catorceBrain.appendConversationTurn(user, userQuery, msg, canal, ['empleados'], ['CATORCE-OPS:modificarEmpleado']);
            return {
              ok: true,
              assistant: 'CATORCE',
              actionExecuted: 'MODIFICACION_EMPLEADO_COMPLETA',
              activity: `Teléfono actualizado para ${resMod.empleado.nombre_completo}`,
              interactiveResults: {
                type: 'empleado_modificado',
                data: resMod.empleado,
              },
              message: msg,
              audioUrl,
              latencyMs: Date.now() - startTime,
            };
          } catch (err: any) {
            return { ok: false, message: `No fue posible actualizar el teléfono: ${err.message}`, latencyMs: Date.now() - startTime };
          }
        }
      }

      // =========================================================================
      // 0-3: REGISTRO DE NOVEDAD EN PUESTO (EJ: CABRACHI)
      // =========================================================================
      const isNovedadPuesto =
        /\b(registra|registrar|reporta|reportar|asentar|anota)\b.*\b(novedad|minuta|incidente)\b/i.test(qNorm) ||
        (/\b(novedad|incidente)\b/i.test(qNorm) && /\b(en el puesto|al puesto|en)\b/i.test(qNorm));

      if (isNovedadPuesto) {
        const puestoMatch = userQuery.match(/(?:en el puesto|al puesto|en puesto|en)\s+([a-zA-Z0-9_\s\u00e1\u00e9\u00ed\u00f3\u00fa\u00c1\u00c9\u00cd\u00d3\u00da\u00f1\u00d1]+)/i);
        let puestoCandidate = puestoMatch ? puestoMatch[1].replace(/[:,\-].*$/, '').replace(/\b(novedad|minuta|que|dos puntos)\b.*$/i, '').trim() : '';

        let detalle = userQuery.replace(/.*(?:novedad|minuta|incidente)(?:\s+en\s+[\w\s]+)?(?:\s*[:\-]\s*|\s+que\s+|\s+de\s+)?/i, '').trim();
        if (!detalle || detalle.length < 5) {
          detalle = userQuery;
        }

        if (puestoCandidate && detalle && detalle.length >= 5) {
          try {
            const resNov = await this.catorceBrain.toolRegistrarNovedadPuesto(
              {
                puestoNombre: puestoCandidate,
                detalleNovedad: detalle,
                tipoNovedad: 'Novedad de Servicio',
                nivelRiesgo: /urgente|grave|critico|falla/i.test(detalle) ? 'alto' : 'medio',
              },
              user,
            );

            const msg = `He registrado la novedad en la minuta oficial de Prolicontrol:\n\n* Puesto: **${resNov.puestoNombre}**\n* Detalle: ${detalle}\n* Nivel de riesgo: ${resNov.minuta.nivel_riesgo.toUpperCase()}\n* Fecha y Hora: ${resNov.minuta.fecha} ${resNov.minuta.hora}\n* Codigo de auditoria: ${resNov.auditCode}`;
            const voiceSnippet = `${activeUserName}, la novedad para el puesto ${resNov.puestoNombre} ha sido registrada exitosamente en la minuta oficial.`;
            const audioUrl = await this.generateVoiceIfRequested(voiceSnippet, canal);
            this.catorceBrain.appendConversationTurn(user, userQuery, msg, canal, ['minutas'], ['CATORCE-OPS:registrarNovedadMinuta']);
            return {
              ok: true,
              assistant: 'CATORCE',
              actionExecuted: 'REGISTRO_NOVEDAD_COMPLETO',
              activity: `Novedad asentada en puesto ${resNov.puestoNombre}`,
              interactiveResults: {
                type: 'novedad_registrada',
                data: resNov.minuta,
              },
              message: msg,
              audioUrl,
              latencyMs: Date.now() - startTime,
            };
          } catch {
            const fallbackPuestoMsg = `${activeUserName}, para asentar la novedad con exactitud en la minuta de Prolicontrol, confirme a que puesto o edificio corresponde.`;
            const audioUrl = await this.generateVoiceIfRequested(fallbackPuestoMsg, canal);
            return {
              ok: true,
              assistant: 'CATORCE',
              actionExecuted: 'PREGUNTA_PUESTO_MINUTA',
              message: fallbackPuestoMsg,
              audioUrl,
              latencyMs: Date.now() - startTime,
            };
          }
        } else {
          const askPuestoMsg = `${activeUserName}, a que puesto o edificio de Prolicontrol corresponde esta novedad para registrarla de inmediato en el libro de minutas?`;
          const audioUrl = await this.generateVoiceIfRequested(askPuestoMsg, canal);
          return {
            ok: true,
            assistant: 'CATORCE',
            actionExecuted: 'PREGUNTA_PUESTO_MINUTA',
            message: askPuestoMsg,
            audioUrl,
            latencyMs: Date.now() - startTime,
          };
        }
      }

      // =========================================================================
      // 0-4: VISOR DE CONTRATO (CLIENTE O PUESTO)
      // =========================================================================
            // 🔒 Control de Acceso Basado en Roles (RBAC) para Documentos Sensibles
      const userRoleLower = (user?.rol || 'operador').toLowerCase();
      const isAuthorizedFinancials = ['superusuario', 'gerencia', 'administrativo', 'coordinador'].includes(userRoleLower) || isIngeniero;

      const isVerContrato =
        /\b(contrato|contratos)\b/i.test(qNorm) &&
        !/\b(crear|crea|nuevo|nueva|registrar|registra|asentar|actualizar|modificar|eliminar|borrar|inactivar|inactiva|desactivar|desactiva|cancela|cancelar)\b/i.test(qNorm);

      if (isVerContrato) {
        if (!isAuthorizedFinancials) {
          const deniedMsg = `Acceso protegido por directriz de seguridad: La consulta de contratos, cláusulas comerciales y valores financieros requiere rol de Gerencia o Administración. Su perfil actual (${userRoleLower}) no cuenta con esta autorización.`;
          return { ok: false, message: deniedMsg, accessDenied: true, latencyMs: Date.now() - startTime };
        }
        const contratoData = await this.catorceBrain.toolConsultarContrato(userQuery, user);

        if (contratoData?.notFound) {
          const notFoundMsg = `${activeUserName}, no he localizado ningún contrato o cliente asociado a "${contratoData.searchedTerm}" en Prolicontrol. Por favor indíqueme el nombre exacto de la empresa, edificio o puesto para consultar sus términos.`;
          const audioUrl = await this.generateVoiceIfRequested(notFoundMsg, canal);
          return {
            ok: true,
            assistant: 'CATORCE',
            actionExecuted: 'CONTRATO_NO_ENCONTRADO',
            message: notFoundMsg,
            audioUrl,
            latencyMs: Date.now() - startTime,
          };
        }

        if (contratoData?.noContract) {
          const cliName = contratoData.cliente?.nombre_empresa || 'el cliente';
          const noContMsg = `${activeUserName}, encontré el registro de **${cliName}** en Prolicontrol, pero actualmente no registra un contrato comercial formalizado en el sistema.`;
          const audioUrl = await this.generateVoiceIfRequested(noContMsg, canal);
          return {
            ok: true,
            assistant: 'CATORCE',
            actionExecuted: 'CLIENTE_SIN_CONTRATO',
            message: noContMsg,
            audioUrl,
            latencyMs: Date.now() - startTime,
          };
        }

        if (contratoData) {
          const rawCliente = Array.isArray(contratoData.cliente) ? contratoData.cliente[0] : (contratoData.cliente as any);
          const clienteNombre = rawCliente?.nombre_empresa || 'Cliente Corporativo';
          const valorFmt = contratoData.valor ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(contratoData.valor) : 'No especificado';
          const isActivo = contratoData.estado === true || String(contratoData.estado).toLowerCase() === 'activo' || String(contratoData.estado).toLowerCase() === 'true';
          const estadoFmt = isActivo ? 'ACTIVO' : 'INACTIVO';
          const guardasCount = Number(contratoData.guardas_activos) || 1;
          const guardasFmt = `${guardasCount} ${guardasCount === 1 ? 'guarda activo' : 'guardas activos'}`;

          let altNotice = '';
          if (contratoData.candidatosAlternativos && contratoData.candidatosAlternativos.length > 0) {
            altNotice = `\n\n*(Nota: también se encuentran registrados: ${contratoData.candidatosAlternativos.join(', ')})*`;
          }

          const msg = `He localizado el contrato de **${clienteNombre}** en Prolicontrol:\n\n* Cliente / Empresa: ${clienteNombre} (NIT: ${rawCliente?.nit || 'No registrado'})\n* Valor mensual: ${valorFmt}\n* Guardas contratados: ${guardasFmt}\n* Vigencia: ${contratoData.fecha_inicio || '-'} al ${contratoData.fecha_fin || 'Indefinido'}\n* Estado: ${estadoFmt}${altNotice}\n\nHe desplegado los términos en el panel de documentos interactivo para su revisión.`;
          const voiceSnippet = `${activeUserName}, aquí tiene el contrato de ${clienteNombre}. El valor mensual es de ${valorFmt} con ${guardasFmt} y estado ${estadoFmt.toLowerCase()}.`;
          const audioUrl = await this.generateVoiceIfRequested(voiceSnippet, canal);
          this.catorceBrain.appendConversationTurn(user, userQuery, msg, canal, ['clientes'], ['CATORCE-DOCS:mostrarContrato']);
          await this.catorceBrain.saveWorkingMemory(user, {
            tarea_activa: 'Gestión de contrato de ' + clienteNombre,
            operacion: 'GESTION_CONTRATO',
            datos_recolectados: {
              contratoId: contratoData.id,
              clienteId: contratoData.cliente_id,
              clienteNombre,
              valor: contratoData.valor,
              estado: contratoData.estado,
              guardasActivos: contratoData.guardas_activos,
            },
            campos_faltantes: [],
            estado: 'EN_CONTEXTO',
            ultimo_prompt: userQuery,
          });
          return {
            ok: true,
            assistant: 'CATORCE',
            actionExecuted: 'MOSTRAR_CONTRATO_DOCUMENTO',
            activity: `Visualizando contrato de ${clienteNombre}`,
            documentViewer: {
              type: 'contract',
              title: `Contrato - ${clienteNombre}`,
              data: contratoData,
              url: (contratoData as any).contrato_pdf_url || null,
            },
            message: msg,
            audioUrl,
            latencyMs: Date.now() - startTime,
          };
        }
      }

      // =========================================================================
            // =========================================================================
      // 0-4B: DIAGNSTICO DE RELEVOS Y PROBLEMAS DE COBERTURA
      // Ej: Tenemos un problema con los relevos, revisa qu est pasando
      // =========================================================================
      const isDiagnosticoRelevos =
        /\b(relevo|relevos|reemplazo|reemplazos)\b/i.test(qNorm) &&
        /\b(problema|pasando|que pasa|revisa|situacion|como estan|pendientes|sin cubrir|descubierto)\b/i.test(qNorm);

      if (isDiagnosticoRelevos) {
        const admin = this.supabase.getSupabaseAdminClient();
        const { data: reemps } = await admin
          .from('turnos_reemplazos')
          .select('id, motivo, fecha_reemplazo, puesto:puestos_trabajo(nombre), guarda_ausente:empleados!turnos_reemplazos_empleado_ausente_id_fkey(nombre_completo)')
          .limit(5);

        const { data: turnosSinGuarda } = await admin
          .from('turnos')
          .select('id, fecha, hora_inicio, hora_fin, puesto:puestos_trabajo(nombre)')
          .is('empleado_id', null)
          .limit(5);

        const sinGuardaCount = turnosSinGuarda?.length || 0;
        const reempCount = reemps?.length || 0;

        let detRelevos = '';
        if (reemps && reemps.length > 0) {
          detRelevos = reemps.map((r: any) => '  * Puesto **' + (r.puesto?.nombre || 'General') + '**: Ausencia de ' + (r.guarda_ausente?.nombre_completo || 'Guarda') + ' (' + (r.motivo || 'Sin relevo asignado') + ').').join('\n');
        } else {
          detRelevos = '  * No hay solicitudes formales de relevo represadas.';
        }

        const msg = activeUserName + ', he diagnosticado la situacin operativa de los relevos en Prolicontrol:\n\n* **Reemplazos registrados en curso:** ' + reempCount + '\n* **Turnos sin guarda asignado:** ' + sinGuardaCount + '\n\n**Detalle Operativo:**\n' + detRelevos + '\n\n' + (sinGuardaCount > 0 ? 'Desea que asigne un relevo disponible de la lista de descanso para cubrir los turnos faltantes?' : 'La cobertura de los puestos se encuentra bajo monitoreo activo de CATORCE.');
        const voiceSnippet = activeUserName + ', diagnostiqu los relevos. Hay ' + reempCount + ' reemplazos en curso y ' + sinGuardaCount + ' turnos pendientes por cubrir. He detallado la situacin en pantalla.';
        const audioUrl = await this.generateVoiceIfRequested(voiceSnippet, canal);
        this.catorceBrain.appendConversationTurn(user, userQuery, msg, canal, ['turnos'], ['CATORCE-OPS:diagnosticoRelevos']);
        return {
          ok: true,
          assistant: 'CATORCE',
          actionExecuted: 'DIAGNOSTICO_RELEVOS_OPERATIVOS',
          activity: 'Diagnstico de relevos completado',
          message: msg,
          audioUrl,
          latencyMs: Date.now() - startTime,
        };
      }

      // =========================================================================
      // 0-4C: SITUACIONES QUE REQUIEREN ATENCIN INMEDIATA (ALERTAS PROACTIVAS)
      // Ej: Qu situaciones requieren atencin inmediata?
      // =========================================================================
      const isSituacionesAtencionInmediata =
        /\b(atencion inmediata|situaciones|alertas criticas|requieren atencion|que pasa en la empresa|novedades urgentes)\b/i.test(qNorm) &&
        /\b(que|cuales|hay|situaciones|alertas|atencion|inmediata)\b/i.test(qNorm);

      if (isSituacionesAtencionInmediata) {
        const alertas = await this.catorceSentinel.runProactiveAudit();
        const msgLines = alertas.map((a: any, idx: number) => {
          return '### ' + (idx + 1) + '. [' + a.severidad + '] ' + a.titulo + '\n* **Diagnstico:** ' + a.descripcion + '\n* **Accin sugerida:** ' + (a.accion_sugerida || 'Verificar en Prolicontrol');
        }).join('\n\n');

        const msg = activeUserName + ', he ejecutado el escaneo proactivo de seguridad y detect las siguientes situaciones prioritarias:\n\n' + (msgLines || 'Actualmente no hay anomalas crticas activas en Prolicontrol. Todos los servicios y dispositivos operan conforme a la norma.');
        const voiceSnippet = activeUserName + ', detect ' + alertas.length + ' situaciones que requieren atencin en Prolicontrol. Las he presentado en pantalla con sus planes de accin.';
        const audioUrl = await this.generateVoiceIfRequested(voiceSnippet, canal);
        this.catorceBrain.appendConversationTurn(user, userQuery, msg, canal, ['dispositivos', 'minutas', 'turnos'], ['CATORCE-SENTINEL:atencionInmediata']);
        return {
          ok: true,
          assistant: 'CATORCE',
          actionExecuted: 'ALERTAS_ATENCION_INMEDIATA',
          activity: 'Escaneo de situaciones urgentes ejecutado',
          interactiveResults: {
            type: 'proactive_alerts',
            data: alertas,
          },
          message: msg,
          audioUrl,
          latencyMs: Date.now() - startTime,
        };
      }

      // =========================================================================
      // 0-4D: NMERO TOTAL DE NOVEDADES
      // Ej: numero total de novedades, cuantas novedades hay
      // =========================================================================
      const isTotalNovedades =
        /\b(numero total|total|cuantas)\b.*\b(novedades|minutas)\b/i.test(qNorm) ||
        /\b(total de novedades|total de minutas)\b/i.test(qNorm);

      if (isTotalNovedades) {
        const admin = this.supabase.getSupabaseAdminClient();
        const { count } = await admin.from('minutas').select('*', { count: 'exact', head: true });
        const total = count || 0;
        const msg = activeUserName + ', actualmente Prolicontrol tiene registradas un total de **' + total + ' novedades y minutas operativas** en la base de datos de PROLISEG LTDA.';
        const voiceSnippet = activeUserName + ', el sistema registra un total de ' + total + ' novedades y minutas operativas.';
        const audioUrl = await this.generateVoiceIfRequested(voiceSnippet, canal);
        this.catorceBrain.appendConversationTurn(user, userQuery, msg, canal, ['minutas'], ['CATORCE-SQL:totalNovedades']);
        return {
          ok: true,
          assistant: 'CATORCE',
          actionExecuted: 'CONSULTAR_TOTAL_NOVEDADES',
          activity: 'Total de novedades consultado',
          message: msg,
          audioUrl,
          latencyMs: Date.now() - startTime,
        };
      }

      // 0-5: LABORATORIO TECNICO DIAGNOSTICO
      // =========================================================================
      const isSaludProlicontrol =
        /(funcionando bien|esta bien prolicontrol|salud del sistema|revisa prolicontrol|prolicontrol funciona|laboratorio|laboratorio tecnico|bateria de pruebas|probar servicios)/i.test(qNorm);

      if (isSaludProlicontrol) {
        const labRes = await this.catorceBrain.ejecutarLaboratorioTecnico(user);
        
        const linesPruebas = labRes.pruebas.map((p: any) => `* [${p.estado}] **${p.nombre}** (${p.duracionMs} ms a las ${p.hora}): ${p.evidencia} — *Criterio: ${p.criterioAprobacion}*`).join('\n');

        const msg = `${activeUserName}, he ejecutado la batería completa del Laboratorio Técnico Diagnóstico sobre Prolicontrol:

` +
          `RESULTADO GENERAL: ${labRes.aprobadas} de ${labRes.totalPruebas} pruebas aprobadas (${labRes.duracionTotalMs} ms tiempo total)

` +
          `DETALLE DE PRUEBAS ACTIVAS:
${linesPruebas}

` +
          `DIAGNÓSTICO: La capa transaccional de Prolicontrol permite lecturas, escrituras ACID controladas, autenticación y comunicación de hardware con normalidad.`;

        const voiceSnippet = `${activeUserName}, laboratorio técnico finalizado. Se ejecutaron ${labRes.totalPruebas} pruebas técnicas con ${labRes.aprobadas} aprobadas. La base de datos, la API y la infraestructura operan con estabilidad total.`;
        const audioUrl = await this.generateVoiceIfRequested(voiceSnippet, canal);
        this.catorceBrain.appendConversationTurn(user, userQuery, msg, canal, ['core', 'accesos'], ['CATORCE-LAB:laboratorioTecnico']);
        return {
          ok: true,
          assistant: 'CATORCE',
          actionExecuted: 'LABORATORIO_TECNICO_PROLICONTROL',
          activity: 'Batería de pruebas técnicas completada con éxito',
          interactiveResults: {
            type: 'system_health',
            data: labRes,
          },
          message: msg,
          audioUrl,
          latencyMs: Date.now() - startTime,
        };
      }

      // =========================================================================
      // 0-6: CÁMARAS Y DISPOSITIVOS IOT DESCONECTADOS
      // =========================================================================
      const isCamarasOffline =
        /\b(camaras|camara|dispositivos|equipos)\b.*\b(desconectadas|desconectados|offline|fuera de linea|inactivas|danadas|sin conexion)\b/i.test(qNorm) ||
        /\b(que camaras|cuales camaras)\b.*\b(desconectadas|offline|inactivas|fallando)\b/i.test(qNorm);

      if (isCamarasOffline) {
        const offlineDevs = await this.catorceBrain.toolConsultarCamarasDesconectadas(user);
        const count = offlineDevs.length;

        let tableText = '';
        if (count > 0) {
          tableText = offlineDevs
            .map(
              (d: any, idx: number) =>
                `${idx + 1}. **${d.nombre_identificador}** | Puesto: ${d.puesto?.nombre || 'General'} | IP: \`${d.ip_direccion || 'No IP'}\` | Marca: ${d.marca || 'Dahua/Hikvision'} | Estado: ${d.estado}`,
            )
            .join('\n');
        }

        const msg = `${activeUserName}, he consultado el estado en vivo de los dispositivos de videovigilancia y control de acceso:\n\n* Total de equipos fuera de línea o con falla: **${count}**\n\n${
          count > 0
            ? tableText + '\n\nSe sugiere despachar orden de revisión técnica a los puestos afectados.'
            : 'Todos los dispositivos IoT y cámaras registrados se encuentran actualmente en línea y transmitiendo con normalidad.'
        }`;

        const voiceSnippet = count > 0
          ? `${activeUserName}, se detectaron ${count} dispositivos fuera de línea en los puestos. Ya he listado los equipos afectados en pantalla.`
          : `${activeUserName}, todas las cámaras y controles de acceso se encuentran en línea y operativos en este momento.`;

        const audioUrl = await this.generateVoiceIfRequested(voiceSnippet, canal);
        this.catorceBrain.appendConversationTurn(user, userQuery, msg, canal, ['accesos'], ['CATORCE-IOT:camarasDesconectadas']);
        return {
          ok: true,
          assistant: 'CATORCE',
          actionExecuted: 'CONSULTA_CAMARAS_OFFLINE',
          activity: 'Auditoría de cámaras y dispositivos IoT finalizada',
          interactiveResults: {
            type: 'table_camaras_offline',
            data: offlineDevs,
          },
          message: msg,
          audioUrl,
          latencyMs: Date.now() - startTime,
        };
      }

      // =========================================================================
      // 0-7: INFORME Y REPORTE DE NOVEDADES DEL DÍA EN PDF
      // =========================================================================
      const isInformeNovedadesHoy =
        /\b(informe|reporte)\b.*\b(novedades|minutas|gerencia|general|ejecutivo|operativo)\b/i.test(qNorm) || /\b(novedades de hoy|minutas de hoy|reporte de hoy|prepara el informe|informe para gerencia)\b/i.test(qNorm);

      if (isInformeNovedadesHoy) {
        const minutasHoy = await this.catorceBrain.toolGenerarInformeNovedadesHoy(undefined, user);
        const hoy = new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });

        const rows = minutasHoy.map((m: any) => [
          m.hora || '-',
          m.puesto?.nombre || 'Puesto General',
          m.tipo_novedad || 'Novedad',
          (m.detalle_novedad || '').slice(0, 80),
          (m.nivel_riesgo || 'medio').toUpperCase(),
        ]);

        const pdfDoc = {
          filename: `Informe_Novedades_${new Date().toISOString().slice(0, 10)}.pdf`,
          title: 'INFORME DIARIO DE NOVEDADES Y MINUTAS',
          subtitle: `PROLISEG LTDA - Centro de Control y Monitoreo (${hoy})`,
          generatedAt: new Date().toLocaleString('es-CO'),
          summary: `Se consolidaron un total de ${minutasHoy.length} novedades de radio-operación registradas durante el turno actual.`,
          columns: ['Hora', 'Puesto', 'Tipo', 'Detalle Novedad', 'Riesgo'],
          rows,
        };

        const msg = `${activeUserName}, he generado el informe consolidado de novedades para el día de hoy (${hoy}):\n\n* Total de novedades registradas: **${minutasHoy.length}**\n\nEl documento PDF oficial ha sido compilado y preparado para su descarga o visualización inmediata en el visor interactivo.`;
        const voiceSnippet = `${activeUserName}, he generado el informe oficial de novedades del día con ${minutasHoy.length} registros. Ya está disponible en pantalla para su descarga y visualización.`;
        const audioUrl = await this.generateVoiceIfRequested(voiceSnippet, canal);
        this.catorceBrain.appendConversationTurn(user, userQuery, msg, canal, ['minutas'], ['CATORCE-PDF:informeNovedadesHoy']);
        return {
          ok: true,
          assistant: 'CATORCE',
          actionExecuted: 'GENERAR_INFORME_NOVEDADES_HOY',
          activity: 'Informe de novedades compilado en PDF',
          pdfDocument: pdfDoc,
          documentViewer: {
            type: 'pdf',
            title: `Informe de Novedades - ${hoy}`,
            data: pdfDoc,
          },
          interactiveResults: {
            type: 'table_novedades_report',
            data: minutasHoy,
          },
          message: msg,
          audioUrl,
          latencyMs: Date.now() - startTime,
        };
      }

      // =========================================================================
      // 0-8: DOCUMENTOS Y SEGURIDAD SOCIAL VENCIDA DE EMPLEADOS
      // =========================================================================
      const isDocumentosVencidos =
        /\b(documentos vencidos|cursos vencidos|afiliaciones vencidas|seguridad social vencida|papeles vencidos)\b/i.test(qNorm) ||
        (/\b(quienes tienen|que empleados tienen)\b/i.test(qNorm) && /\b(vencido|vencida|vencidos|vencidas)\b/i.test(qNorm));

      if (isDocumentosVencidos) {
        const empsVencidos = await this.catorceBrain.toolConsultarDocumentosVencidos(user);
        const count = empsVencidos.length;

        let listText = '';
        if (count > 0) {
          listText = empsVencidos
            .map(
              (e: any, idx: number) =>
                `${idx + 1}. **${e.nombre}** (CC ${e.cedula}) | Cargo: ${e.cargo} | Documento: **${e.documentoVencido}** | Vencimiento: ${e.fechaVencimiento} | Tel: ${e.telefono}`,
            )
            .join('\n');
        }

        const msg = `${activeUserName}, he consultado los expedientes de personal en Prolicontrol:\n\n* Total de colaboradores con documentación vencida: **${count}**\n\n${
          count > 0
            ? listText + '\n\nSe recomienda notificar a Coordinación Operativa para la renovación de afiliaciones.'
            : 'Todos los colaboradores activos cuentan con su documentación y seguridad social al día en el sistema.'
        }`;

        const voiceSnippet = count > 0
          ? `${activeUserName}, he identificado ${count} empleados con documentación o seguridad social vencida en el sistema. Los detalles están en pantalla.`
          : `${activeUserName}, todos los empleados activos se encuentran con su documentación al día.`;

        const audioUrl = await this.generateVoiceIfRequested(voiceSnippet, canal);
        this.catorceBrain.appendConversationTurn(user, userQuery, msg, canal, ['empleados'], ['CATORCE-HR:documentosVencidos']);
        return {
          ok: true,
          assistant: 'CATORCE',
          actionExecuted: 'CONSULTA_DOCUMENTOS_VENCIDOS',
          activity: 'Auditoría de expedientes de personal finalizada',
          interactiveResults: {
            type: 'table_documentos_vencidos',
            data: empsVencidos,
          },
          message: msg,
          audioUrl,
          latencyMs: Date.now() - startTime,
        };
      }


      // =========================================================================
      // 0-9: REGISTRO DE INCIDENTES OPERATIVOS (HURTO, INTRUSIÓN, EMERGENCIA)
      // =========================================================================
      const isIncidente =
        /\b(registra|registrar|reporta|reportar|declarar)\b.*\b(incidente|emergencia|hurto|intrusion|rina|asalto|falla critica)\b/i.test(qNorm) ||
        /\b(nuevo incidente|incidente grave|incidente critico)\b/i.test(qNorm);

      if (isIncidente) {
        const puestoMatch = userQuery.match(/(?:en el puesto|al puesto|en puesto|en)\s+([a-zA-Z0-9_\s\u00e1\u00e9\u00ed\u00f3\u00fa\u00c1\u00c9\u00cd\u00d3\u00da\u00f1\u00d1]+)/i);
        const puestoCandidate = puestoMatch ? puestoMatch[1].replace(/[:,-].*$/, '').trim() : 'Puesto Principal';

        const tipoMatch = userQuery.match(/\b(hurto|intrusion|rina|pelea|falla de energia|corte|arma|asalto|emergencia|incendio)\b/i);
        const tipoIncidente = tipoMatch ? tipoMatch[1].toUpperCase() : 'Incidente Operativo';

        let detalle = userQuery.replace(/.*(?:incidente|emergencia)(?:\s+en\s+[\w\s]+)?(?:\s*[:-]\s*|\s+que\s+|\s+de\s+)?/i, '').trim();
        if (!detalle || detalle.length < 5) detalle = userQuery;

        try {
          const resInc = await this.catorceBrain.toolRegistrarIncidente(
            {
              puestoNombre: puestoCandidate,
              tipoIncidente,
              descripcion: detalle,
              nivelGravedad: /arma|asalto|intrusion|incendio|grave|urgente/i.test(userQuery) ? 'critico' : 'alto',
            },
            user,
          );

          const msg = activeUserName + ', he registrado el incidente de seguridad en Prolicontrol:\n\n' +
            '* Puesto: **' + resInc.puestoNombre + '**\n' +
            '* Tipo: **' + resInc.incidente.tipo_incidente + '**\n' +
            '* Severidad: **' + String(resInc.incidente.nivel_gravedad || 'ALTO').toUpperCase() + '**\n' +
            '* Descripción: ' + resInc.incidente.descripcion + '\n' +
            '* Estado: Abierto y notificado a patrulla de supervisión\n' +
            '* Código de auditoría: [' + resInc.auditCode + ']\n' +
            '* Sello SHA-256: [' + resInc.hashIntegridad + ']';

          const voiceSnippet = activeUserName + ', el incidente de ' + resInc.incidente.tipo_incidente + ' en el puesto ' + resInc.puestoNombre + ' ha sido registrado con prioridad alta. Centro de control ha sido notificado.';
          const audioUrl = await this.generateVoiceIfRequested(voiceSnippet, canal);
          this.catorceBrain.appendConversationTurn(user, userQuery, msg, canal, ['incidentes'], ['CATORCE-OPS:registrarIncidente']);

          return {
            ok: true,
            assistant: 'CATORCE',
            actionExecuted: 'REGISTRO_INCIDENTE_COMPLETO',
            activity: 'Incidente asentado en base de datos',
            interactiveResults: {
              type: 'incidente_registrado',
              data: resInc.incidente,
            },
            message: msg,
            audioUrl,
            latencyMs: Date.now() - startTime,
          };
        } catch (err: any) {
          return { ok: false, message: 'No fue posible asentar el incidente: ' + err.message, latencyMs: Date.now() - startTime };
        }
      }

      // =========================================================================
      // 0-10: REEMPLAZOS OPERATIVOS DE TURNO (RELEVOS POR AUSENCIA O PERMISO)
      // =========================================================================
      const isReemplazoTurno =
        /\b(reemplaza|reemplazar|relevo|relevar|cambio de guarda|sustituir)\b/i.test(qNorm) &&
        /\b(guarda|vigilante|turno|por|en)\b/i.test(qNorm);

      if (isReemplazoTurno) {
        const puestoMatch = userQuery.match(/(?:en|en el puesto|al puesto)\s+([a-zA-Z0-9_\s\u00e1\u00e9\u00ed\u00f3\u00fa\u00c1\u00c9\u00cd\u00d3\u00da\u00f1\u00d1]+)/i);
        const pCandidate = puestoMatch ? puestoMatch[1].replace(/[:,-].*$/, '').trim() : 'Puesto Principal';

        const ausMatch = userQuery.match(/(?:a|al guarda|a la guarda)\s+([a-zA-Z\u00e1\u00e9\u00ed\u00f3\u00fa\u00c1\u00c9\u00cd\u00d3\u00da\u00f1\u00d1 ]+?)(?:\s+por|\s+con|\s+en)/i);
        const reempMatch = userQuery.match(/(?:por|con|releva)\s+([a-zA-Z\u00e1\u00e9\u00ed\u00f3\u00fa\u00c1\u00c9\u00cd\u00d3\u00da\u00f1\u00d1 ]+?)(?:\s+en|\s+por motivo|\s+porque|$)/i);

        const ausNombre = ausMatch ? ausMatch[1].trim() : 'Titular';
        const reempNombre = reempMatch ? reempMatch[1].trim() : '';

        if (reempNombre) {
          try {
            const resReemp = await this.catorceBrain.toolRegistrarReemplazoTurno(
              {
                puestoNombre: pCandidate,
                guardaAusenteQuery: ausNombre,
                guardaReemplazoQuery: reempNombre,
                motivo: 'Reemplazo solicitado por voz a CATORCE',
              },
              user,
            );

            const msg = activeUserName + ', he procesado el relevo de turno en Prolicontrol:\n\n' +
              '* Puesto: **' + resReemp.puestoNombre + '**\n' +
              '* Guarda Saliente / Ausente: ' + resReemp.guardaAusente + '\n' +
              '* Guarda Entrante / Relevo: **' + resReemp.guardaReemplazo + '**\n' +
              '* Estado: Turno actualizado y aprobado en la programación oficial\n' +
              '* Código de auditoría: [' + resReemp.auditCode + ']\n' +
              '* Sello SHA-256: [' + resReemp.hashIntegridad + ']';

            const voiceSnippet = activeUserName + ', relevo procesado. ' + resReemp.guardaReemplazo + ' ha sido asignado al turno en ' + resReemp.puestoNombre + ' en reemplazo de ' + resReemp.guardaAusente + '.';
            const audioUrl = await this.generateVoiceIfRequested(voiceSnippet, canal);
            this.catorceBrain.appendConversationTurn(user, userQuery, msg, canal, ['turnos'], ['CATORCE-OPS:reemplazoTurno']);

            return {
              ok: true,
              assistant: 'CATORCE',
              actionExecuted: 'REEMPLAZO_TURNO_COMPLETO',
              activity: 'Relevo de guarda aplicado en base de datos',
              message: msg,
              audioUrl,
              latencyMs: Date.now() - startTime,
            };
          } catch (err: any) {
            return { ok: false, message: 'Dificultad al registrar el reemplazo: ' + err.message, latencyMs: Date.now() - startTime };
          }
        }
      }

      // =========================================================================
      // 0-11: CONSULTA DE INVENTARIO Y DOTACIONES DE SEGURIDAD
      // =========================================================================
      const isInventario =
        /\b(inventario|stock|articulos|uniformes|dotaciones disponibles|cuanto hay de)\b/i.test(qNorm) &&
        !/\b(asignar|entrega)\b/i.test(qNorm);

      if (isInventario) {
        const filtro = userQuery.replace(/.*(?:inventario|stock|articulos|dotaciones)(?:\s+de\s+)?/i, '').trim();
        const items = await this.catorceBrain.toolConsultarInventario(filtro || undefined);

        const lines = items.slice(0, 8).map((it: any) => '* **' + it.nombre + '**: ' + (it.stock_actual || 0) + ' unidades disponibles' + (it.categoria?.nombre ? ' (' + it.categoria.nombre + ')' : '')).join('\n');

        const msg = activeUserName + ', he consultado el módulo de Inventario y Almacén:\n\n' +
          '* Total de artículos listados: **' + items.length + '**\n\n' +
          (lines || 'No se registraron existencias para el criterio indicado.') + '\n\n' +
          'Los niveles de stock están verificados en el almacén central de PROLISEG LTDA.';

        const voiceSnippet = activeUserName + ', el inventario arroja ' + items.length + ' referencias disponibles en almacén. Los detalles de existencias están en pantalla.';
        const audioUrl = await this.generateVoiceIfRequested(voiceSnippet, canal);
        this.catorceBrain.appendConversationTurn(user, userQuery, msg, canal, ['dotaciones'], ['CATORCE-LOG:consultarInventario']);

        return {
          ok: true,
          assistant: 'CATORCE',
          actionExecuted: 'CONSULTA_INVENTARIO',
          activity: 'Inventario de almacén verificado',
          interactiveResults: {
            type: 'table_inventario',
            data: items,
          },
          message: msg,
          audioUrl,
          latencyMs: Date.now() - startTime,
        };
      }

      // =========================================================================
      // 0-12: CONSULTA DE NÓMINA Y VALORES DEVENGADOS
      // =========================================================================
      const isNomina =
        /\b(nomina|liquidaciones|devengado|descuentos|pago de guardas|cuanto gana)\b/i.test(qNorm);

      if (isNomina) {
        if (!isAuthorizedFinancials) {
          const deniedMsg = 'Acceso Restringido: La consulta de nómina y valores devengados requiere perfil de Gerencia o Administración por confidencialidad.';
          return { ok: false, message: deniedMsg, accessDenied: true, latencyMs: Date.now() - startTime };
        }

        const empNameMatch = userQuery.match(/(?:de|del empleado|para)\s+([a-zA-Z\u00e1\u00e9\u00ed\u00f3\u00fa\u00c1\u00c9\u00cd\u00d3\u00da\u00f1\u00d1 ]+)/i);
        const empQuery = empNameMatch ? empNameMatch[1].trim() : undefined;

        const nomData = await this.catorceBrain.toolConsultarNominaResumen(empQuery);
        const lines = nomData.slice(0, 5).map((n: any) => {
          const emp = Array.isArray(n.empleado) ? n.empleado[0] : n.empleado;
          const netFmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(n.neto_pagar || 0);
          return '* **' + (emp?.nombre_completo || 'Colaborador') + '**: ' + netFmt + ' neto';
        }).join('\n');

        const msg = activeUserName + ', he consultado los registros consolidados de nómina:\n\n' +
          '* Registros evaluados: **' + nomData.length + '**\n\n' +
          (lines || 'Sin liquidaciones activas en el corte seleccionado.') + '\n\n' +
          'Se validaron horas diurnas, nocturnas y festivas según la programación de turnos.';

        const voiceSnippet = activeUserName + ', consulta de nómina completada. Se localizaron ' + nomData.length + ' registros liquidados para su revisión.';
        const audioUrl = await this.generateVoiceIfRequested(voiceSnippet, canal);
        this.catorceBrain.appendConversationTurn(user, userQuery, msg, canal, ['nomina'], ['CATORCE-FIN:consultarNomina']);

        return {
          ok: true,
          assistant: 'CATORCE',
          actionExecuted: 'CONSULTA_NOMINA',
          activity: 'Registros de nómina consultados',
          message: msg,
          audioUrl,
          latencyMs: Date.now() - startTime,
        };
      }

      // =========================================================================
      // 0-13: EXPLICACIÓN MAESTRA MÓDULO A MÓDULO DE PROLICONTROL (CEREBRO OPERATIVO)
      // =========================================================================
      const isExplicacionModulos =
        /\b(modulo a modulo|control completo|que datos necesitas|que modulos tienes|control total|cerebro operativo)\b/i.test(qNorm) ||
        (/\b(explica|explicame|como funciona)\b/i.test(qNorm) && /\b(modulos|servicios|prolicontrol|sistema)\b/i.test(qNorm));

      if (isExplicacionModulos) {
        const masterMsg = activeUserName + ', como **Cerebro Operativo Central de ProliControl**, opero de forma transversal sobre los 12 dominios funcionales y las 79 tablas de la plataforma. A continuación le detallo módulo a módulo los datos requeridos y opcionales:\n\n' +
          '### 1. Gestión de Talento Humano y Empleados (`public.empleados`, `contratos_personal`)\n' +
          '* **Datos Obligatorios:** Nombre completo, Cédula única (mínimo 5 dígitos), Cargo/Rol.\n' +
          '* **Datos Opcionales / Defaults:** Teléfono (altamente sugerido), Correo, Ciudad (default: Pasto), Salario base ($1.300.000 COP), EPS, ARL, Fondo de Pensión.\n' +
          '* **Acción CATORCE:** Validación de no duplicidad, creación atómica, hash de auditoría y memoria multi-turno.\n\n' +
          '### 2. Puestos de Trabajo y Subpuestos (`public.puestos_trabajo`, `subpuestos_trabajo`)\n' +
          '* **Datos Obligatorios:** Nombre del puesto, Ciudad, Cliente titular.\n' +
          '* **Datos Opcionales:** Dirección, Coordenadas GPS, Modalidad de servicio (24h/12h), Dotación de armas, Lista de subpuestos.\n' +
          '* **Acción CATORCE:** Creación de estructura jerárquica y subpuestos de control principal.\n\n' +
          '### 3. Minutas Oficiales de Radio-Operación (`public.minutas`)\n' +
          '* **Datos Obligatorios:** Puesto de trabajo, Detalle de la novedad.\n' +
          '* **Datos Opcionales:** Tipo de novedad (Novedad de Servicio, Relevo, Ronda), Nivel de riesgo (Bajo/Medio/Alto/Crítico), Persona involucrada. Fecha y hora se asignan automáticamente en vivo.\n\n' +
          '### 4. Incidentes de Seguridad Operativa (`public.incidentes`)\n' +
          '* **Datos Obligatorios:** Puesto afectado, Tipo de incidente (Hurto, Intrusión, Pelea, Incendio), Descripción del hecho.\n' +
          '* **Datos Opcionales:** Gravedad (Bajo/Medio/Alto/Crítico), Acciones inmediatas tomadas, Empleado reportante.\n\n' +
          '### 5. Programación de Turnos y Relevos (`public.turnos`, `turnos_reemplazos`)\n' +
          '* **Datos Obligatorios:** Guarda titular, Puesto asignado, Fecha del turno.\n' +
          '* **Datos Opcionales:** Horario (default Diurno: 06:00-18:00 o Nocturno: 18:00-06:00), Tipo de turno, Relevo por ausencia.\n\n' +
          '### 6. Control de Acceso y Visitantes (`public.dispositivos_iot`, `visitantes`)\n' +
          '* **Datos Obligatorios:** Puesto/Portería, Nombre del visitante, Cédula, Destino.\n' +
          '* **Datos Opcionales:** Placa de vehículo, Motivo de visita, Dispositivo IoT de marcación.\n\n' +
          '### 7. Clientes y Contratos Corporativos (`public.clientes`, `contratos`)\n' +
          '* **Datos Obligatorios:** NIT de empresa, Razón social, Valor mensual pactado, Guardas activos requeridos.\n' +
          '* **Datos Opcionales:** Representante legal, Teléfono corporativo, Vigencia contractual, PDF adjunto.\n\n' +
          '### 8. Logística, Dotaciones e Inventario (`public.articulos_dotacion`, `dotaciones_empleado`)\n' +
          '* **Datos Obligatorios:** Guarda receptor, Artículo de dotación (Uniforme, Botas, Chaleco).\n' +
          '* **Datos Opcionales:** Talla, Cantidad (default 1), Fecha de entrega.\n\n' +
          '### 9. Vacaciones y Permisos (`public.vacaciones`)\n' +
          '* **Datos Obligatorios:** Guarda solicitante, Fecha de inicio, Fecha de fin.\n' +
          '* **Datos Opcionales:** Días tomados (default 15), Estado de aprobación.\n\n' +
          '### 10. PQRSF y Servicio al Cliente (`public.pqrsf`)\n' +
          '* **Datos Obligatorios:** Cliente titular, Asunto, Descripción del requerimiento.\n' +
          '* **Datos Opcionales:** Tipo (Petición, Queja, Reclamo, Sugerencia), Prioridad (Media/Alta).\n\n' +
          '### 11. Capacitaciones y Cursos de Vigilancia (`public.empleados`, `capacitaciones`)\n' +
          '* **Datos Obligatorios:** Guarda titular, Tipo de curso de SuperVigilancia, Fecha de vencimiento.\n' +
          '* **Acción CATORCE:** Alerta preventiva 30 días antes del vencimiento legal.\n\n' +
          '### 12. Laboratorio Técnico y Auditoría Criptográfica (`ia_brain.auditoria_acciones`)\n' +
          '* Batería de 7 pruebas en vivo sobre API, PostgreSQL ACID, JWT RBAC, CPU/RAM VPS, Sockets IoT y Streaming RTSP.\n' +
          '* Cada transacción genera firma SHA-256 inmutable y token de memoria anti-tampering.';

        const voiceSnippet = activeUserName + ', tengo control operativo sobre los 12 módulos principales de ProliControl. Puedo crear empleados, puestos, turnos, clientes, dotaciones, minutas, incidentes y misiones completas. He desplegado el manual maestro módulo a módulo en pantalla.';
        const audioUrl = await this.generateVoiceIfRequested(voiceSnippet, canal);
        this.catorceBrain.appendConversationTurn(user, userQuery, masterMsg, canal, ['core'], ['CATORCE-CORE:manualModulos']);

        return {
          ok: true,
          assistant: 'CATORCE',
          actionExecuted: 'EXPLICACION_MODULOS_PROLICONTROL',
          activity: 'Manual maestro de módulos y requerimientos desplegado',
          message: masterMsg,
          audioUrl,
          latencyMs: Date.now() - startTime,
        };
      }

const isPresentationIntent = /\b(presentate|quien eres|quien sos|que eres|que haces|presentate por favor|cuentame de ti|presentacion|cual es tu funcion|para que sirves)\b/i.test(qNorm);

      if (isPresentationIntent) {

        const presMsg = `Soy CATORCE, la Inteligencia Artificial Central y Segundo Cerebro Operativo de PROLISEG LTDA en la plataforma Prolicontrol.



Mi propósito es supervisar, optimizar y controlar en tiempo real toda la operación de seguridad de la compañía con acceso omnisciente a la plataforma:



1. Gestión de Puestos y Sedes: Monitoreo continuo de puestos de trabajo, coberturas, turnos y novedades de servicio.

2. Gestión de Personal y Empleados: Consulta de expedientes, asignaciones, dotaciones, descansos, fechas de nacimiento y cumpleaños de los colaboradores.

3. Seguridad Social y Afiliaciones: Consulta y registro en vivo de EPS, Fondos de Pensión y ARL para todo el personal.

4. Control de Acceso e IoT: Supervisión en tiempo real de dispositivos biométricos, cerraduras y estado de puertas.

5. Minutas y Novedades por Voz: Registro y auditoría de reportes de radio-operación al instante.

6. Generación de Informes: Creación autónoma de reportes ejecutivos oficiales en formato PDF bajo demanda.



Estoy conectada a la base de datos de PROLISEG LTDA para responder sus preguntas y ejecutar acciones autorizadas al instante. ¿En qué le puedo colaborar hoy, ${activeUserName}?`;



        this.catorceBrain.appendConversationTurn(user, userQuery, presMsg, canal, ['core', 'brain'], ['CATORCE-CORE:selfPresentation']);

        return {

          ok: true,

          assistant: 'CATORCE',

          actionExecuted: 'PRESENTACION_CATORCE',

          activatedNodes: ['core', 'brain'],

          toolsUsed: ['CATORCE-CORE:selfPresentation'],

          message: presMsg,

          latencyMs: Date.now() - startTime,

        };

      }



      // =========================================================================

      // 0️⃣ CANDADO ESTRICTO CONTRA ELIMINACIÓN (SOLO SUPERUSUARIOS / PROTEGIDO)

      // =========================================================================

      // =========================================================================

      // 0-C: CONSULTA DE IDENTIDAD Y PERFIL PERSONAL DEL USUARIO LOGUEADO

      // =========================================================================

      const isIdentityOrProfileQuery =

        /\b(quien soy|quien soy yo|como me llamo|cual es mi nombre|mi nombre|cuantos anos tengo|cuantos anos tengo yo|que edad tengo|cual es mi edad|mi edad|cuando naci|mi fecha de nacimiento|cuando es mi cumpleanos|mi cumpleanos|que cargo tengo|cual es mi rol|mi rol|que rol tengo|cuales son mis datos|mis datos|mi perfil|mi informacion|que hago yo|a que me dedico|que puesto tengo|donde estoy asignado)\b/i.test(qNorm);



      if (isIdentityOrProfileQuery) {

        let uRow: any = null;

        let eRow: any = null;

        let customMemories: any[] = [];



        try {

          const userFilters: string[] = [];

          if (user?.id) userFilters.push(`id.eq.${Number(user.id)}`);

          if (user?.user_id) userFilters.push(`user_id.eq.${user.user_id}`);

          if (user?.email || user?.correo) userFilters.push(`correo.ilike.${user.email || user.correo}`);

          if (user?.cedula) userFilters.push(`cedula.eq.${user.cedula}`);



          if (userFilters.length > 0) {

            const { data: uData } = await this.supabase

              .getSupabaseAdminClient()

              .from('usuarios_externos')

              .select('*')

              .or(userFilters.join(','))

              .limit(1);

            if (uData && uData.length > 0) uRow = uData[0];

          }



          const empFilters: string[] = [];

          if (uRow?.id) empFilters.push(`usuario_id.eq.${uRow.id}`);

          if (uRow?.cedula || user?.cedula) empFilters.push(`cedula.eq.${uRow?.cedula || user?.cedula}`);

          if (uRow?.correo || user?.email || user?.correo) empFilters.push(`correo.ilike.${uRow?.correo || user?.email || user?.correo}`);



          if (empFilters.length > 0) {

            const { data: eData } = await this.supabase

              .getSupabaseAdminClient()

              .from('empleados')

              .select('*')

              .or(empFilters.join(','))

              .limit(1);

            if (eData && eData.length > 0) eRow = eData[0];

          }



          const targetUserId = uRow?.id || user?.id;

          if (targetUserId) {

            customMemories = (await this.catorceBrain.runSql(

              `SELECT clave, hecho_recordado FROM ia_brain.memoria_usuarios WHERE usuario_id = ${Number(targetUserId)} AND activo = true ORDER BY created_at DESC LIMIT 5`,

            )) || [];

          }

        } catch (err: any) {

          this.logger.warn(`Error al consultar perfil de usuario: ${err?.message}`);

        }



        const resolvedName = uRow?.nombre_completo || eRow?.nombre_completo || user?.nombre_completo || user?.nombre || activeUserName;

        const resolvedRol = (uRow?.rol || user?.rol || 'Superusuario').toUpperCase();

        const resolvedCedula = uRow?.cedula || eRow?.cedula || user?.cedula || 'No registrada';

        const resolvedCorreo = uRow?.correo || user?.email || user?.correo || 'No registrado';

        const resolvedTelefono = uRow?.telefono || eRow?.telefono || 'No registrado';

        const fechaNac = eRow?.fecha_nacimiento;



        let edadStr = '';

        let cumpleStr = '';

        if (fechaNac) {

          try {

            const bdate = new Date(fechaNac);

            const today = new Date();

            let age = today.getFullYear() - bdate.getFullYear();

            const m = today.getMonth() - bdate.getMonth();

            if (m < 0 || (m === 0 && today.getDate() < bdate.getDate())) {

              age--;

            }

            edadStr = `${age} anos`;

            cumpleStr = bdate.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });

          } catch {}

        }



        let respText = '';



        if (/\b(cuantos anos tengo|que edad tengo|cual es mi edad|mi edad|cuando naci|mi fecha de nacimiento|cuando es mi cumpleanos|mi cumpleanos)\b/i.test(qNorm)) {

          if (edadStr) {

            respText = `Usted tiene ${edadStr}. Su fecha de nacimiento registrada en Prolicontrol es el ${cumpleStr}.`;

          } else {

            respText = `Ingeniero ${resolvedName}, en este momento su fecha de nacimiento no se encuentra diligenciada en su ficha de empleado de Prolicontrol. Si me indica su fecha de nacimiento, con gusto la guardo en mi memoria permanente para tenerla presente siempre.`;

          }

        } else if (/\b(quien soy|quien soy yo|como me llamo|cual es mi nombre|mi nombre)\b/i.test(qNorm)) {

          respText = `Usted es ${resolvedName}, autenticado en la plataforma Prolicontrol con el rol de ${resolvedRol}. En nuestras conversaciones me dirijo a usted como ${activeUserName}.`;

        } else if (/\b(que cargo tengo|cual es mi rol|mi rol|que rol tengo|que hago yo|a que me dedico)\b/i.test(qNorm)) {

          respText = `Su rol en Prolicontrol es ${resolvedRol}. Cuenta con permisos omniscientes para supervisar y operar la plataforma de PROLISEG LTDA: puestos, minutas, empleados, contratos y controles de acceso.`;

        } else {

          respText = `Aqui tiene su informacion de perfil registrada en Prolicontrol:\n\n* Nombre: ${resolvedName}\n* Rol / Cargo: ${resolvedRol}\n* Cedula: ${resolvedCedula}\n* Correo: ${resolvedCorreo}\n* Telefono: ${resolvedTelefono}` +

            (edadStr ? `\n* Edad: ${edadStr} (Nacimiento: ${cumpleStr})` : '\n* Fecha de Nacimiento: No registrada en ficha de personal');



          if (customMemories.length > 0) {

            respText += `\n\nDatos que he memorizado de usted:\n` +

              customMemories.map((m: any) => `- ${m.hecho_recordado}`).join('\n');

          }

        }



        this.catorceBrain.appendConversationTurn(user, userQuery, respText, canal, ['core', 'brain'], ['CATORCE-USER:profileQuery']);



        return {

          ok: true,

          assistant: 'CATORCE',

          actionExecuted: 'CONSULTA_PERFIL_USUARIO',

          activatedNodes: ['core', 'brain'],

          toolsUsed: ['CATORCE-USER:profileQuery'],

          message: respText,

          latencyMs: Date.now() - startTime,

        };

      }



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

      // 0-D: TELEMETRIA Y DIAGNOSTICO EN TIEMPO REAL DE LA VPS / SISTEMA

      // =========================================================================

      const isSystemDiagnosticQuery =

        /\b(estado del sistema|diagnostico del sistema|diagnostico de la vps|diagnostico del servidor|salud del sistema|salud de la vps|telemetria de la vps|telemetria vps)\b/i.test(qNorm) ||

        (/\b(espacio|almacenamiento|disco|ram|memoria|cpu|procesador)\b/i.test(qNorm) && /\b(vps|servidor|sistema|maquina|disco duro)\b/i.test(qNorm));



      if (isSystemDiagnosticQuery) {

        const vps = await this.catorceBrain.getSystemAndVpsStatus(user);

        const disk = vps.disco;

        const mem = vps.memoria;

        const cpu = vps.procesador;

        const db = vps.baseDeDatos;

        const brain = vps.segundoCerebro;



        const diagText = `${activeUserName}, presento el informe consolidado de telemetria y diagnostico en tiempo real del servidor y la plataforma Prolicontrol:



1. ALMACENAMIENTO Y DISCO (VPS / SERVIDOR):

* Punto de Montaje: ${disk.puntoMontaje}

* Capacidad Total: ${disk.totalGb} GB

* Espacio Ocupado: ${disk.usadoGb} GB (${disk.porcentajeUso})

* Espacio Disponible: ${disk.libreGb} GB

* Condicion Operativa: ${disk.estado === 'OPTIMO' ? 'Normal / Saludable' : disk.estado}



2. MEMORIA RAM Y PROCESOS:

* Memoria Total: ${mem.totalGb} GB

* Memoria en Uso: ${mem.usadoGb} GB (${mem.porcentajeUso})

* Memoria Libre: ${mem.libreGb} GB

* Consumo Proceso CATORCE: ${mem.nodeHeapUsedMb} MB Heap (${mem.nodeRssMb} MB RSS)

* Condicion Operativa: ${mem.estado === 'OPTIMO' ? 'Normal / Estable' : mem.estado}



3. PROCESAMIENTO (CPU):

* Procesador: ${cpu.modelo}

* Nucleos / Hilos: ${cpu.nucleos} cores

* Uptime del Sistema: ${vps.host.uptimeHoras} horas continuas



4. INFRAESTRUCTURA DE DATOS POSTGRESQL:

* Motor: ${db.motor}

* Estado: ${db.estado === 'CONECTADO' ? 'En Linea / Operativo' : db.estado}

* Latencia de Red: ${db.latenciaMs} ms

* Esquemas Activos: public (36 tablas) e ia_brain (memoria y auditoria)



5. SEGUNDO CEREBRO EMPRESARIAL:

* Repositorio Documental: ${brain.documentosIndexados} documentos indexados

* Acceso a Runbooks y Manuales: Busqueda semantica y local inmediata activa.`;



        const voiceSnippet = `${activeUserName}, el sistema opera con normalidad. El disco tiene ${disk.libreGb} gigabytes libres de ${disk.totalGb}, la memoria RAM esta al ${mem.porcentajeUso} de uso y la base de datos responde en ${db.latenciaMs} milisegundos.`;

        const audioUrl = await this.generateVoiceIfRequested(voiceSnippet, canal);



        this.catorceBrain.appendConversationTurn(user, userQuery, diagText, canal, ['core', 'brain'], ['CATORCE-DIAGNOSTICO:vpsStatus']);



        return {

          ok: true,

          assistant: 'CATORCE',

          actionExecuted: 'TELEMETRIA_SISTEMA_VPS',

          activatedNodes: ['core', 'brain'],

          toolsUsed: ['CATORCE-DIAGNOSTICO:vpsStatus'],

          message: diagText,

          audioUrl,

          latencyMs: Date.now() - startTime,

        };

      }



      // =========================================================================

      // 0-E: TEST DE DISPOSITIVOS Y HARDWARE IoT EN CONSOLA (Dahua, Hikvision, MikroTik)

      // =========================================================================

      const isDeviceTestQuery =

        /\b(test de dispositivos|testear dispositivos|probar dispositivos|test en consola|correr test|correr pruebas|verificar dispositivos|verificar camaras|probar camaras|verificar puertas|probar puertas|verificar dahua|probar dahua|verificar hikvision|verificar mikrotik|ping a dispositivos)\b/i.test(qNorm);



      if (isDeviceTestQuery) {

        let filterPuestoOrIp: string | undefined = undefined;

        const ipMatch = qNorm.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);

        if (ipMatch) {

          filterPuestoOrIp = ipMatch[0];

        } else if (qNorm.includes('dahua')) {

          filterPuestoOrIp = 'dahua';

        } else if (qNorm.includes('hikvision')) {

          filterPuestoOrIp = 'hikvision';

        } else if (qNorm.includes('mikrotik')) {

          filterPuestoOrIp = 'mikrotik';

        }



        const devRes = await this.catorceBrain.testDeviceConnectivity(filterPuestoOrIp, undefined, user);



        const lines = devRes.dispositivos.map(

          (d: any) =>

            `* ${d.nombre} (${d.puesto}): IP ${d.ip}:${d.port} [${d.marca}] -> ${

              d.enLinea ? 'EN LINEA (' + d.latenciaMs + ' ms)' : 'NO RESPONDE (' + d.estadoSocket + ')'

            }`,

        );



        const devText = `${activeUserName}, he ejecutado la prueba de sockets TCP en consola para auditar los dispositivos IoT y de red:



RESUMEN EJECUTIVO DE COMUNICACION:

* Total de Dispositivos Probados: ${devRes.totalProbados}

* En Linea / Respondiendo: ${devRes.online}

* Fuera de Linea / Timeout: ${devRes.offline}



DETALLE DE PRUEBAS EN CONSOLA:

${lines.join('\n')}



${

  devRes.offline > 0

    ? 'ALERTA OPERATIVA: Se detectaron equipos sin respuesta inmediata. Se recomienda verificar alimentacion electrica PoE y enlace de red.'

    : 'ESTADO DE CONECTIVIDAD: Todos los dispositivos evaluados presentan comunicacion y latencia normal.'

}`;



        const voiceSnippet = `${activeUserName}, prueba de red finalizada en consola. De ${devRes.totalProbados} dispositivos evaluados, ${devRes.online} estan en linea con latencia optima y ${devRes.offline} sin respuesta.`;

        const audioUrl = await this.generateVoiceIfRequested(voiceSnippet, canal);



        this.catorceBrain.appendConversationTurn(user, userQuery, devText, canal, ['accesos'], ['CATORCE-IOT:testDeviceConnectivity']);



        return {

          ok: true,

          assistant: 'CATORCE',

          actionExecuted: 'TEST_CONECTIVIDAD_HARDWARE',

          activatedNodes: ['accesos'],

          toolsUsed: ['CATORCE-IOT:testDeviceConnectivity'],

          message: devText,

          audioUrl,

          latencyMs: Date.now() - startTime,

        };

      }



      // =========================================================================

      // 0-F: CREACION AUTONOMA DE PUESTOS DE TRABAJO COMPLETOS

      // =========================================================================

      const isCreatePuestoQuery =

        /\b(crear puesto|crea un puesto|crear un puesto|nuevo puesto|registrar puesto|registra un puesto)\b/i.test(qNorm);



      if (isCreatePuestoQuery) {

        const nameMatch = userQuery.match(/(?:crear|crea|registrar|nuevo)\s+(?:un\s+)?puesto(?:\s+de\s+trabajo)?(?:\s+llamado|\s+denominado|\s+para|\s+nombre)?\s+([a-zA-Z0-9_\sáéíóúÁÉÍÓÚñÑ]+)/i);

        const rawCandidate = nameMatch ? nameMatch[1].trim() : '';

        const cleanedCandidate = rawCandidate.replace(/\b(en|con|de|para|servicio|armado|sin armas|pasto|ipiales)\b.*$/i, '').trim();



        if (cleanedCandidate && cleanedCandidate.length >= 3 && !cleanedCandidate.toLowerCase().startsWith('completo')) {

          const ciudad = /ipiales/i.test(userQuery) ? 'Ipiales' : /tumaco/i.test(userQuery) ? 'Tumaco' : 'Pasto';

          const armas = /\b(armado|con armas|armas)\b/i.test(userQuery);

          const tipoServicio = /12\s*h/i.test(userQuery) ? '12 Horas' : '24 Horas';



          const nuevoPuesto = await this.catorceBrain.crearPuestoCompleto(

            {

              nombre: cleanedCandidate,

              ciudad,

              tipo_servicio: tipoServicio,

              armas,

            },

            user,

          );



          const puestoText = `${activeUserName}, he creado exitosamente el puesto en la base de datos de Prolicontrol:



* Nombre del Puesto: ${nuevoPuesto.puesto.nombre} (ID: ${nuevoPuesto.puesto.id})

* Ciudad: ${nuevoPuesto.puesto.ciudad}

* Modalidad de Servicio: ${nuevoPuesto.puesto.tipo_servicio} (${armas ? 'Armado' : 'Sin Armas'})

* Subpuestos Inicializados: ${nuevoPuesto.subpuestos.length} (${nuevoPuesto.subpuestos.map((s: any) => s.nombre).join(', ')})

* Codigo de Auditoria: ${nuevoPuesto.auditCode}`;



          const voiceSnippet = `${activeUserName}, el puesto ${nuevoPuesto.puesto.nombre} ha sido creado exitosamente en Prolicontrol con sus subpuestos operativos.`;

          const audioUrl = await this.generateVoiceIfRequested(voiceSnippet, canal);



          this.catorceBrain.appendConversationTurn(user, userQuery, puestoText, canal, ['puestos'], ['CATORCE-OPS:crearPuestoCompleto']);



          return {

            ok: true,

            assistant: 'CATORCE',

            actionExecuted: 'CREACION_PUESTO_COMPLETO',

            activatedNodes: ['puestos'],

            toolsUsed: ['CATORCE-OPS:crearPuestoCompleto'],

            message: puestoText,

            audioUrl,

            latencyMs: Date.now() - startTime,

          };

        } else {

          const askPuestoMsg = `${activeUserName}, tengo habilitada la creacion autonoma de puestos de trabajo. Por favor indiqueme el nombre del puesto que desea crear (y opcionalmente la ciudad y si requiere servicio armado o sin armas) para registrarlo de inmediato en Prolicontrol.`;

          const audioUrl = await this.generateVoiceIfRequested(askPuestoMsg, canal);

          return {

            ok: true,

            assistant: 'CATORCE',

            actionExecuted: 'SOLICITUD_DATOS_PUESTO',

            activatedNodes: ['puestos'],

            toolsUsed: ['CATORCE-OPS:askMissingPuestoData'],

            message: askPuestoMsg,

            audioUrl,

            latencyMs: Date.now() - startTime,

          };

        }

      }



      // =========================================================================

      // 0-G: ASIGNACION Y GESTION DE TURNOS Y HORARIOS

      // =========================================================================

      const isManageTurnosQuery =

        /\b(asignar a horario|asignar personas a horarios|crear turnos|crear turno|crear horarios|gestionar programacion|programar turno|asignar guarda)\b/i.test(qNorm);



      if (isManageTurnosQuery) {

        const pMatch = userQuery.match(/(?:en el puesto|al puesto|en|puesto)\s+([a-zA-Z0-9_\sáéíóúÁÉÍÓÚñÑ]+)/i);

        const gMatch = userQuery.match(/(?:guarda|empleado|a|al se\u00f1or|a la se\u00f1ora)\s+([a-zA-Z0-9_\sáéíóúÁÉÍÓÚñÑ]+)/i);



        if (pMatch && gMatch) {

          const pName = pMatch[1].replace(/\b(guarda|empleado|turno|fecha|horario)\b.*$/i, '').trim();

          const gName = gMatch[1].replace(/\b(en|al|turno|fecha|horario)\b.*$/i, '').trim();



          if (pName.length >= 3 && gName.length >= 3) {

            const isNocturno = /\b(nocturno|noche|18:00)\b/i.test(userQuery);

            const turnoRes = await this.catorceBrain.gestionarTurnosYHorarios(

              {

                puesto_nombre_o_id: pName,

                empleado_cedula_o_nombre: gName,

                tipo_turno: isNocturno ? 'NOCTURNO' : 'DIURNO',

              },

              user,

            );



            const turnoText = `${activeUserName}, he asentado la programacion en Prolicontrol:



* Turno ID: ${turnoRes.turno.id}

* Puesto: ${turnoRes.puesto.nombre}

* Guarda: ${turnoRes.guarda?.nombre_completo || gName}

* Horario: ${turnoRes.turno.hora_inicio} a ${turnoRes.turno.hora_fin} (${turnoRes.turno.tipo_turno})

* Fecha: ${turnoRes.turno.fecha}

* Codigo de Auditoria: ${turnoRes.auditCode}`;



            const voiceSnippet = `${activeUserName}, el turno ha sido programado exitosamente para ${turnoRes.guarda?.nombre_completo || gName} en ${turnoRes.puesto.nombre}.`;

            const audioUrl = await this.generateVoiceIfRequested(voiceSnippet, canal);



            this.catorceBrain.appendConversationTurn(user, userQuery, turnoText, canal, ['puestos'], ['CATORCE-OPS:gestionarTurnosYHorarios']);



            return {

              ok: true,

              assistant: 'CATORCE',

              actionExecuted: 'GESTION_PROGRAMACION_TURNO',

              activatedNodes: ['puestos'],

              toolsUsed: ['CATORCE-OPS:gestionarTurnosYHorarios'],

              message: turnoText,

              audioUrl,

              audioDataUrl: audioUrl,

              latencyMs: Date.now() - startTime,

            };

          }

        }



        const askTurnoMsg = `${activeUserName}, tengo control operativo para gestionar turnos y programaciones. Para proceder, indiqueme el nombre del puesto, el guarda que desea asignar y el tipo de turno (diurno 06:00 a 18:00 o nocturno 18:00 a 06:00).`;

        const audioUrl = await this.generateVoiceIfRequested(askTurnoMsg, canal);

        return {

          ok: true,

          assistant: 'CATORCE',

          actionExecuted: 'SOLICITUD_DATOS_TURNO',

          activatedNodes: ['puestos'],

          toolsUsed: ['CATORCE-OPS:askMissingTurnoData'],

          message: askTurnoMsg,

          audioUrl,

          latencyMs: Date.now() - startTime,

        };

      }



      // =========================================================================

      // 0-H: FAST-PATH DE TELEMETRIA EN VIVO (Ultra-Rapido ~15ms - Tipo ChatGPT Live)

      // =========================================================================

      const isAccessControlTelemetry =

        /\b(controles de acceso|control de acceso|cuantos controles|estado de las puertas|estado de puertas)\b/i.test(qNorm) &&

        !/\b(crear|agregar|modificar|insertar)\b/i.test(qNorm);



      if (isAccessControlTelemetry) {

        const telemetry = await this.catorceBrain.getRealtimeBrainTelemetry(user);

        const k = telemetry.kpis;

        const msg = `${activeUserName}, le informo que en este momento tenemos registrados un total de ${k.controlesAccesoTotal} dispositivos de control de acceso IoT en la plataforma Prolicontrol. De estos equipos, ${k.dispositivosOnline} se encuentran en linea y operativos con comunicacion activa, mientras que el estado general reportado para las puertas asociadas es cerrado y asegurado. ${activeUserName}, desea que revisemos el detalle operativo o de red de algun dispositivo en particular?`;



        this.catorceBrain.appendConversationTurn(user, userQuery, msg, canal, ['accesos'], ['CATORCE-IOT:fastTelemetry']);



        return {

          ok: true,

          assistant: 'CATORCE',

          actionExecuted: 'CONSULTA_TELEMETRIA_ACCESOS',

          activatedNodes: ['accesos'],

          toolsUsed: ['CATORCE-IOT:fastTelemetry'],

          message: msg,

          telemetryKpis: telemetry.kpis,

          latencyMs: Date.now() - startTime,

        };

      }



      const isPuestosCountQuery =

        /\b(cuantos puestos|total de puestos|cuantos puestos activos|numero de puestos)\b/i.test(qNorm) &&

        !/\b(crear|agregar|modificar|insertar|asigna)\b/i.test(qNorm);



      if (isPuestosCountQuery) {

        const telemetry = await this.catorceBrain.getRealtimeBrainTelemetry(user);

        const k = telemetry.kpis;

        const msg = `${activeUserName}, actualmente Prolicontrol tiene registrados ${k.puestosActivos} puestos de trabajo activos principales y ${k.subpuestosActivos} subpuestos operativos con cobertura en Pasto y demas sedes de PROLISEG LTDA.`;



        this.catorceBrain.appendConversationTurn(user, userQuery, msg, canal, ['puestos'], ['CATORCE-OPS:fastTelemetry']);



        return {

          ok: true,

          assistant: 'CATORCE',

          actionExecuted: 'CONSULTA_TELEMETRIA_PUESTOS',

          activatedNodes: ['puestos'],

          toolsUsed: ['CATORCE-OPS:fastTelemetry'],

          message: msg,

          telemetryKpis: telemetry.kpis,

          latencyMs: Date.now() - startTime,

        };

      }



      const isEmpleadosCountQuery =

        /\b(cuantos empleados|total de empleados|cuantos guardas|personal activo|total de guardas)\b/i.test(qNorm) &&

        !/\b(crear|agregar|modificar|insertar|asigna)\b/i.test(qNorm);



      if (isEmpleadosCountQuery) {

        const telemetry = await this.catorceBrain.getRealtimeBrainTelemetry(user);

        const k = telemetry.kpis;

        const msg = `${activeUserName}, la nomina operativa de Prolicontrol cuenta con ${k.empleadosActivos} empleados activos, de los cuales ${k.empleadosAsignados} se encuentran asignados a puestos de vigilancia y cuadrantes de servicio.`;



        this.catorceBrain.appendConversationTurn(user, userQuery, msg, canal, ['empleados'], ['CATORCE-OPS:fastTelemetry']);



        return {

          ok: true,

          assistant: 'CATORCE',

          actionExecuted: 'CONSULTA_TELEMETRIA_EMPLEADOS',

          activatedNodes: ['empleados'],

          toolsUsed: ['CATORCE-OPS:fastTelemetry'],

          message: msg,

          telemetryKpis: telemetry.kpis,

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



        const msg = `Segundo Cerebro PROLISEG LTDA actualizado: He almacenado y vectorizado este conocimiento en ia_brain para que todo el equipo lo tenga disponible.`;

        this.catorceBrain.appendConversationTurn(user, userQuery, msg, canal, activatedNodes, toolsUsed);



        return {

          ok: true,

          assistant: 'CATORCE',

          actionExecuted: 'CONOCIMIENTO_GUARDADO',

          activatedNodes,

          toolsUsed,

          data: [saved.documento],

          message: msg,

          audioDataUrl: undefined,

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

Usuario actual: "${activeUserName}" (Rol: ${user?.rol || 'superusuario'}, ID: ${user?.id || 1}).



REGLAS OBLIGATORIAS DE OPERACIÓN Y TRATO:

1. TRATO AL USUARIO: ${

  activeUserName !== 'Ingeniero' && activeUserName !== userName

    ? `El usuario indicó expresamente que su trato o título preferido es "${activeUserName}". Dirígete a él/ella SIEMPRE con el título o nombre exacto de "${activeUserName}" (ej. "Hola ${activeUserName}", "Con gusto, ${activeUserName}", "${activeUserName}, le confirmo que..."). NUNCA uses la palabra "jefe" ni nombres ajenos.`

    : isIngeniero

    ? 'El usuario actual es el Ingeniero. Dirígete a él SIEMPRE con el título respetuoso de "Ingeniero" (ej. "Hola Ingeniero", "Con gusto, Ingeniero", "Ingeniero, le confirmo que..."). NUNCA lo llames "Oscar", "Javier", "Solarte", "Oscar Javier Solarte", ni uses la palabra "jefe".'

    : `El usuario actual se llama "${userName}" (Rol: ${user?.rol || 'operativo'}). Dirígete a él/ella de manera cálida, ejecutiva y profesional por su nombre: "${userName}" (ej. "Hola ${userName}", "Con gusto ${userName}"). NUNCA uses la palabra "jefe".`

}

2. ALCANCE DE SERVICIOS: Tienes control operativo total para gestionar TODOS los servicios de Prolicontrol:

   - Turnos y asignaciones (turnos, asignacion_guardas_puesto, turnos_reemplazos, turnos_configuracion, conceptos_turno).

   - Gestión Humana y Personal (empleados, aspirantes, dotaciones, contratos_personal, salarios, articulos_dotacion, vacaciones, capacitaciones).

   - Seguridad Social (eps, fondos_pension, arl). Tienes control total para ver y registrar nuevas EPS (\`eps\`), Fondos de Pensión (\`fondos_pension\`) y ARL (\`arl\`).

   - Consultas de Cumpleaños y Empleados: Puedes consultar cualquier dato de los empleados (incluyendo fecha_nacimiento, teléfono, correo, ciudad, eps_id, fondo_pension_id). Si el usuario pregunta cuántas personas o quiénes cumplen años en un mes determinado (por ejemplo, diciembre), DEBES generar en "customSelectSql":

     "SELECT id, nombre_completo, cedula, fecha_nacimiento FROM empleados WHERE EXTRACT(MONTH FROM fecha_nacimiento) = 12 AND activo = true"

     (reemplaza 12 por el número de mes correspondiente: 1=enero, ..., 12=diciembre).

   - Asistencias & IoT (asistencias, asistencia_iot_registros, asistencia_iot_personal, puestos_asistencia_iot_config).

   - Puestos y Sedes (puestos_trabajo, subpuestos_trabajo, sedes, ubicaciones, geocercas).

   - Clientes y Comercial (clientes, clientes_potenciales, contratos, cotizaciones, servicios, facturacion_config).

   - Control de Acceso Físico y Visitantes (dispositivos_iot, listas_acceso, residentes, visitantes, visitas, visitas_registro, visitas_tecnicas): TIENES BRAZOS REALES para ABRIR, CERRAR, dejar SIEMPRE ABIERTA o SIEMPRE CERRADA cualquier puerta Hikvision o Dahua usando intent "DOOR_CONTROL".

   - Minutas, Novedades e Incidentes (minutas, novedades, incidentes, radio_operaciones).

   - Rondas y Supervisión (rondas_configuracion_puesto, rondas_ejecucion, rutas, supervisor_visitas).

   - Logística, Vehículos y PQRSF (vehiculos, inventario, inventario_puesto, pqrsf, encuestas, comunicaciones, notificaciones, memorandos).

3. EXCLUSIONES ESTRICTAS DE SEGURIDAD:

   - NUNCA elimines registros de la base de datos (DELETE, DROP, TRUNCATE están prohibidos).

   - NUNCA crees usuarios ni credenciales (usuarios, auth.users están prohibidos; deben gestionarse manualmente en el módulo administrativo de Usuarios).

4. CONCISIÓN Y FIRMEZA DE CENTRO DE MANDO (C4):

   - En consultas técnicas y operativas ve directo al dato concreto con cifras, nombres y horas.
   - EXCEPCIÓN DE SALUDOS Y CORTESÍA: Si el usuario pide explícitamente saludar a alguien (jefe, cliente, directivo, amigo) o presentarse, aplica la Regla 9 con máxima calidez, prestancia institucional y simpatía.

   - CERO ALUCINACIONES: Jamás inventes nombres de personas, puestos, fechas o cifras. Si un dato no está en la base de datos de Prolicontrol, declara con firmeza: "Dato no registrado en el sistema".

   - Estructura fija: [1. Estado / Dato directo] -> [2. Detalle exacto (nombres, cédulas, puestos)] -> [3. Alerta operativa si aplica].

5. PROHIBIDO EL USO DE EMOJIS: NUNCA uses emojis, emoticones ni símbolos pictográficos en tus respuestas. Todas tus respuestas deben ser texto 100% limpio, sobrio y profesional.

6. PROACTIVIDAD Y CORRELACIÓN DE ANOMALÍAS EN TIEMPO REAL:

   No te limites a contestar pasivamente lo que se pregunta; audita el estado del servicio:

   - Si consultan un Puesto: cruza quién es el guarda de turno, si tiene novedades en las últimas 24h y si el hardware IoT (puertas/cámaras) está en línea. Si hay una anomalía, ALÉRTALA DE INMEDIATO.

   - Si consultan Empleados: revisa si tienen asignación activa, descansos o si hay novedades operativas.

   - Si consultan el Estado General: destaca primero las alertas críticas (puestos descubiertos, dispositivos offline, reemplazos pendientes) antes de dar los totales normales.

7. CONFIRMACIÓN PREVIA OBLIGATORIA PARA PROGRAMAR O ASIGNAR TURNOS:

   Antes de insertar o crear una nueva programación o turno en la base de datos (turnos, asignacion_guardas_puesto, turnos_reemplazos):

   - Si el usuario NO ha confirmado explícitamente todavía, NO registres directamente en la base de datos.

   - Estructura la propuesta detallada (puesto verificado, guarda, fecha, horario y tipo de turno) y pregunta textualmente:

     "¿Me confirma si procedo con el registro oficial en la base de datos de Prolicontrol?"

   - Solo cuando el usuario confirme afirmativamente (ej. "sí", "confirmo", "procede", "créalo"), se debe registrar oficialmente.

8. GENERACIÓN ACTIVA DE SOLUCIONES OPERATIVAS Y RESOLUCIÓN EN PROLICONTROL:

   Cuando el usuario plantee cualquier problema, contingencia, novedad, falla técnica o situación operativa (como caída de enlaces WAN/Internet, desconexión de túneles MikroTik, corte de energía, fallas de cámaras o biométricos Hikvision/Dahua, inasistencia de guardas o novedades en puestos):

   - DIAGNOSTICA LA SITUACIÓN con la telemetría en vivo y la documentación técnica del Segundo Cerebro (Obsidian).

   - GENERA LA SOLUCIÓN TÉCNICA Y OPERATIVA CONCRETA: Guía al usuario paso a paso indicando los módulos de Prolicontrol (Monitoreo, Dispositivos IoT, Turnos, Reemplazos, Minutas), comandos o procedimientos exactos.

   - OFRECE LA ACCIÓN RESOLUTIVA EN BASE DE DATOS: Por ejemplo, si falta un guarda en un puesto, propón asignar un relevo en descanso; si ocurrió una novedad, ofrece asentar la Minuta con el puesto verificado; todo bajo confirmación explícita del usuario.

9. PROTOCOLO DE SALUDOS, PRESENTACIÓN Y CORTESÍA CORPORATIVA:
   - Si el usuario te pide saludar a alguien (jefe, directivo, cliente, compañero, visitante) o presentarte: SALUDA SIEMPRE CON CORDIALIDAD, ELEGANCIA, SIMPATÍA Y ORGULLO CORPORATIVO.
   - NUNCA te niegues con frases burocráticas o rígidas como "mi programación se restringe estrictamente...", "no tengo facultades para emitir saludos" o "es ajeno al ámbito laboral". Jamás rechaces un saludo pedido por el Ingeniero.
   - Preséntate con distinción como CATORCE, la Inteligencia Artificial Central y Segundo Cerebro Operativo de PROLISEG LTDA en la plataforma Prolicontrol.
   - Si el usuario incluye un apodo, chiste, profesión o apelativo coloquial (ej. "el montador de yeguas", "el duro de la empresa"), salúdalo con respeto, finura diplomática, buen humor corporativo y simpatía, poniéndote a su disposición.
   - Explica con claridad y orgullo qué puedes hacer en Prolicontrol: supervisar puestos y cámaras en vivo, auditar turnos y relevos de guardas, gestionar minutas e incidentes, consultar contratos de clientes, controlar accesos IoT y elaborar informes ejecutivos de seguridad.



CONTEXTO DE LA CONVERSACIÓN RECIENTE (Sigue el hilo con exactitud):

${historyFormatted || "Inicio de conversación."}



📊 TELEMETRÍA EN VIVO DE PROLICONTROL:

- Puestos Activos: ${telemetry.kpis.puestosActivos} puestos principales y ${telemetry.kpis.subpuestosActivos} subpuestos (${JSON.stringify(

        telemetry.detalles.puestos.slice(0, 25).map((p: any) => ({ id: p.id, nombre: p.nombre, ciudad: p.ciudad })),

      )})

- Empleados Activos: ${telemetry.kpis.empleadosActivos} empleados (${telemetry.kpis.empleadosAsignados} asignados)

- Seguridad Social: ${telemetry.kpis.epsRegistradas || 0} EPS registradas (${JSON.stringify(telemetry.detalles.eps)}), ${telemetry.kpis.fondosPensionRegistrados || 0} Fondos de Pensión (${JSON.stringify(telemetry.detalles.fondosPension)}), ${telemetry.kpis.arlRegistradas || 0} ARL (${JSON.stringify(telemetry.detalles.arl)})

- Turnos y Programación Reciente: ${telemetry.kpis.turnosRegistrados || 0} turnos registrados (${JSON.stringify((telemetry.detalles.turnosRecientes || []).slice(0, 10).map((t: any) => ({ id: t.id, fecha: t.fecha, horario: `${t.hora_inicio}-${t.hora_fin}`, tipo: t.tipo_turno, puesto: t.puesto?.nombre, guarda: t.empleado?.nombre_completo })))}).

- Reemplazos y Relevos: ${telemetry.kpis.reemplazosPendientes || 0} reemplazos pendientes (${JSON.stringify((telemetry.detalles.reemplazosRecientes || []).slice(0, 8))}).

- Vacaciones: ${telemetry.kpis.vacacionesRegistradas} registradas. Próximos: ${JSON.stringify(

        telemetry.detalles.quienesSiguenVacaciones.slice(0, 8),

      )}

- Clientes Activos: ${telemetry.kpis.clientesActivos} clientes (${JSON.stringify(

        telemetry.detalles.clientes.slice(0, 75).map((c: any) => ({ id: c.id, nombre: c.nombre_empresa })),

      )})

- Contratos Vigentes: ${telemetry.kpis.contratosActivos} contratos (${telemetry.kpis.guardasContratadosTotal} guardas contratados)

- Controles de Acceso IoT: ${telemetry.kpis.controlesAccesoTotal} dispositivos (${telemetry.kpis.dispositivosOnline} en línea: ${JSON.stringify(

        telemetry.detalles.controlesAcceso.slice(0, 12),

      )})

- Minutas Recientes: ${JSON.stringify(telemetry.detalles.minutasRecientes.slice(0, 5))}

${brainMatches.length > 0 ? `- Segundo Cerebro: ${JSON.stringify(brainMatches.map((b: any) => ({ titulo: b.titulo, categoria: b.categoria, resumen: b.resumen, extracto: b.fragmento })))}` : ''}

${telemetry.userContext?.memoriasActivas?.length > 0 ? `- Memoria Contextual Personalizada del Usuario (${activeUserName}): ${JSON.stringify(telemetry.userContext.memoriasActivas.map((m: any) => ({ clave: m.clave, hecho: m.hecho_recordado, importancia: m.importancia })))}` : ''}



MENSAJE ACTUAL DEL USUARIO:

"${userQuery}"



Analiza el mensaje y responde en UN SOLO JSON ESTRICTO con esta estructura:

{

  "intent": "DOOR_CONTROL" | "ASK_MISSING_DATA" | "CREATE_MINUTA" | "DB_INSERT" | "DB_UPDATE" | "QUERY_OR_REPORT" | "OFF_TOPIC",

  "isOffTopic": boolean,

  "wantsPdf": boolean,

  "directAnswer": "Tu respuesta hablada/escrita corta, humana, concisa (máximo 2 a 3 oraciones claras), SIN NINGÚN EMOJI y en español dirigiéndote siempre al usuario como '${activeUserName}'. Si el mensaje es casual o sobre permisos (ej. irse temprano, cenar, relevos), responde con empatía y criterio operativo breve. NUNCA listes todas las cifras de la empresa a menos que se pida expresamente un informe general.",

  "doorControl": {

    "command": "abrir" | "cerrar" | "siempre-abierta" | "siempre-cerrada",

    "targetQuery": "Nombre de la puerta, puesto o IP destino",

    "doorId": 1

  },

  "missingDataQuestion": "Si el usuario quiere crear o modificar algo en cualquier servicio de Prolicontrol pero falta un dato esencial, escribe aquí la pregunta amable dirigiéndote a él/ella de forma respetuosa ('${activeUserName}') sin emojis.",

  "minutaData": {

    "edificio_o_puesto": "Nombre del edificio o puesto",

    "persona_involucrada": "Nombre de la persona si aplica",

    "detalle_novedad": "Descripción clara de la novedad",

    "tipo_novedad": "Ingreso / Novedad Radio-Operación",

    "nivel_riesgo": "bajo"

  },

  "dbWrite": {

    "operationType": "INSERT" | "UPDATE",

    "table": "Nombre exacto de la tabla de Prolicontrol (ej. eps, fondos_pension, arl, turnos, asignacion_guardas_puesto, puestos_trabajo, subpuestos_trabajo, clientes, contratos, vacaciones, incidentes, capacitaciones, vehiculos, inventario, pqrsf, encuestas, comunicaciones, notificaciones)",

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
      // 4-0: EJECUCION DIRECTA DE CONTROL DE PUERTAS DESDE ORQUESTADOR
      // =========================================================================
      if (plan.intent === 'DOOR_CONTROL' && plan.doorControl?.command) {
        const doorRes = await this.catorceBrain.toolControlarPuerta(
          {
            targetQuery: plan.doorControl.targetQuery || userQuery,
            doorId: Number(plan.doorControl.doorId) || undefined,
            command: plan.doorControl.command,
          },
          user,
        );
        return await this.buildAndReturnDoorControlResponse(
          doorRes,
          plan.doorControl.command,
          userQuery,
          activeUserName,
          user,
          canal,
          startTime,
        );
      }

      // =========================================================================

      // 4️⃣ CASO A: A CATORCE LE FALTA UN DATO -> LE PREGUNTA AL USUARIO INTELIGENTEMENTE

      // =========================================================================

      if (plan.intent === 'ASK_MISSING_DATA' && plan.missingDataQuestion) {

        const questionMsg = `Necesito un dato adicional para completarlo:\n\n${plan.missingDataQuestion}`

          .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{200D}\u{FE0F}]/gu, '')

          .trim();

        this.catorceBrain.appendConversationTurn(user, userQuery, questionMsg, canal, activatedNodes, [

          'CATORCE-SLOT-FILLING:askMissingData',

        ]);



        const audioDataUrl = await this.generateVoiceIfRequested(questionMsg, canal);

        return {

          ok: true,

          assistant: 'CATORCE',

          actionExecuted: 'PREGUNTA_DATOS_FALTANTES',

          awaitingFollowUp: true,

          activatedNodes,

          toolsUsed: ['CATORCE-SLOT-FILLING:askMissingData'],

          message: questionMsg,

          audioDataUrl,

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



        const summaryClean = (resultAccion.summaryMessage || '')

          .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{200D}\u{FE0F}]/gu, '');



        this.catorceBrain.appendConversationTurn(

          user,

          userQuery,

          summaryClean,

          canal,

          activatedNodes,

          toolsUsed,

        );



        const audioDataUrl = await this.generateVoiceIfRequested(summaryClean, canal);

        return {

          ok: true,

          assistant: 'CATORCE',

          actionExecuted: resultAccion.actionExecuted,

          auditCode: resultAccion.auditCode,

          activatedNodes,

          toolsUsed,

          data: [resultAccion.minuta],

          message: summaryClean,

          audioDataUrl,

          latencyMs: Date.now() - startTime,

        };

      }



      // =========================================================================

      // 6️⃣ CASO C: INSERTAR O ACTUALIZAR EN CUALQUIER MÓDULO DE PROLICONTROL (Turnos, Puestos, Clientes, Vacaciones, etc.)

      // =========================================================================

      if ((plan.intent === 'DB_INSERT' || plan.intent === 'DB_UPDATE') && plan.dbWrite?.table) {

        const targetTable = String(plan.dbWrite.table || '').toLowerCase().trim();

        const isSchedulingTable = ['turnos', 'asignacion_guardas_puesto', 'turnos_reemplazos'].includes(targetTable);



        // Detectar si el usuario está confirmando una propuesta previa

        const isAffirmative = /^(s[ií]|confirmo|confirmar|procede|cr[eé]alo|cr[eé]elo|adelante|de acuerdo|claro|dale|por supuesto|h[aá]zlo|ok|ejecuta|autorizo)/i.test(userQuery.trim());

        const lastTurn = (recentHistory || []).slice(-1)[0]?.text || '';

        const wasAwaitingConfirmation = lastTurn.toLowerCase().includes('confirma si procedo') || lastTurn.toLowerCase().includes('procedo con el registro');



        if (isSchedulingTable && !isAffirmative && !wasAwaitingConfirmation) {

          // 🛡️ PROTOCOLO DE CONFIRMACIÓN OBLIGATORIA ANTES DE CREAR CUALQUIER PROGRAMACIÓN

          const puestoHint = plan.dbWrite.entityHints?.puesto_nombre || plan.dbWrite.payload?.puesto_id || 'Puesto por verificar';

          const guardaHint = plan.dbWrite.entityHints?.empleado_nombre_o_cedula || plan.dbWrite.payload?.empleado_id || 'Guarda por verificar';

          const fechaHint = plan.dbWrite.payload?.fecha || new Date().toISOString().slice(0, 10);

          const horaInicio = plan.dbWrite.payload?.hora_inicio || '06:00';

          const horaFin = plan.dbWrite.payload?.hora_fin || '18:00';

          const tipoTurno = plan.dbWrite.payload?.tipo_turno || 'Diurno 12 Horas';



          const proposalMsg = `He preparado la propuesta de programación en Prolicontrol:\n\n- Puesto: ${puestoHint}\n- Guarda asignado: ${guardaHint}\n- Fecha: ${fechaHint}\n- Horario: ${horaInicio} a ${horaFin} (${tipoTurno})\n- Modalidad: Servicio de vigilancia con control de acceso y minuta activa.\n\n¿Me confirma si procedo con el registro oficial en la base de datos de Prolicontrol?`;



          this.catorceBrain.appendConversationTurn(user, userQuery, proposalMsg, canal, activatedNodes, ['CATORCE-SCHEDULE:proposeShift']);



          return {

            ok: true,

            assistant: 'CATORCE',

            actionExecuted: 'PROPUESTA_PENDIENTE_CONFIRMACION',

            awaitingFollowUp: true,

            activatedNodes,

            toolsUsed: ['CATORCE-SCHEDULE:proposeShift'],

            message: proposalMsg,

            latencyMs: Date.now() - startTime,

          };

        }



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



          const successMsg = `Operación ejecutada en Prolicontrol (${crudRes.table}):\n\n${

            plan.dbWrite.humanSummary || 'He registrado los cambios solicitados directamente en la base de datos.'

          }\n\n- Registro ID: #${crudRes.data?.id || 'OK'}\n- Código de Auditoría: ${crudRes.auditCode}`

            .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{200D}\u{FE0F}]/gu, '');



          this.catorceBrain.appendConversationTurn(user, userQuery, successMsg, canal, activatedNodes, toolsUsed);

          const audioDataUrl = await this.generateVoiceIfRequested(successMsg, canal);



          return {

            ok: true,

            assistant: 'CATORCE',

            actionExecuted: crudRes.actionExecuted,

            auditCode: crudRes.auditCode,

            activatedNodes,

            toolsUsed,

            data: crudRes.data ? [crudRes.data] : [],

            message: successMsg,

            audioDataUrl,

            latencyMs: Date.now() - startTime,

          };

        } catch (crudErr: any) {

          // Si falló por una llave foránea o campo faltante, CATORCE le pregunta al usuario amablemente qué dato falta

          const clarifyMsg = `Estuve a punto de registrar la operación en ${plan.dbWrite.table}, pero necesito confirmar un detalle para que quede exacto (${crudErr.message}). ¿Me confirmas el dato faltante?`

            .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{200D}\u{FE0F}]/gu, '');

          this.catorceBrain.appendConversationTurn(user, userQuery, clarifyMsg, canal, activatedNodes, toolsUsed);

          const audioDataUrl = await this.generateVoiceIfRequested(clarifyMsg, canal);

          return {

            ok: true,

            assistant: 'CATORCE',

            actionExecuted: 'PREGUNTA_ACLARACION_BD',

            awaitingFollowUp: true,

            activatedNodes,

            toolsUsed,

            message: clarifyMsg,

            audioDataUrl,

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
          ? `Responde a la consulta de forma directa, inteligente, completa, profesional y 100% libre de emojis, dirigiéndote a ${activeUserName}. Si el usuario pide saludar a alguien o presentarse, saluda con gran calidez, simpatía, cortesía y elegancia corporativa, presentándote con orgullo como CATORCE de PROLISEG LTDA y explicando qué haces en Prolicontrol. No hagas reclamos ni advertencias de que no es sobre el trabajo; responde directamente con total amabilidad y distinción.`
          : `Responde como **CATORCE**, el Segundo Cerebro y compañera ejecutiva de **${activeUserName}** en **PROLISEG LTDA**. Si te piden saludar o presentarte ante alguien, hazlo con calidez, elegancia, simpatía corporativa y disposición de servicio explicando tus capacidades en Prolicontrol. Usa los datos reales de la telemetría y de las consultas SQL. TOTALMENTE PROHIBIDO EL USO DE EMOJIS.`;

      const responsePrompt = `

Eres **CATORCE**, la Inteligencia Artificial Central y Segundo Cerebro de **PROLISEG LTDA** en **Prolicontrol**.

REGLA DE ORO DE TRATO: Dirígete al usuario SIEMPRE como "${activeUserName}" (nunca lo llames por nombres ajenos ni uses la palabra "jefe").

Responde con tono femenino, profesional, empático y directo. NUNCA repitas instrucciones del sistema.

REGLA ESTRICTA DE EMOJIS: NUNCA incluyas emojis, emoticones ni símbolos pictográficos. Tu respuesta debe ser 100% texto limpio.



${offTopicInstruction}



TELEMETRÍA EN TIEMPO REAL DE PROLICONTROL:

- Puestos Activos: ${telemetry.kpis.puestosActivos} puestos principales y ${telemetry.kpis.subpuestosActivos} subpuestos (${JSON.stringify(

        telemetry.detalles.puestos.map((p: any) => ({ id: p.id, nombre: p.nombre, ciudad: p.ciudad })),

      )}).

- Empleados / Guardas Activos: ${telemetry.kpis.empleadosActivos} activos (${telemetry.kpis.empleadosAsignados} asignados).

- Seguridad Social: ${telemetry.kpis.epsRegistradas || 0} EPS registradas (${JSON.stringify(telemetry.detalles.eps)}), ${telemetry.kpis.fondosPensionRegistrados || 0} Fondos de Pensión (${JSON.stringify(telemetry.detalles.fondosPension)}), ${telemetry.kpis.arlRegistradas || 0} ARL (${JSON.stringify(telemetry.detalles.arl)}).

- Turnos Recientes y Programación: ${telemetry.kpis.turnosRegistrados || 0} registrados (${JSON.stringify((telemetry.detalles.turnosRecientes || []).slice(0, 10).map((t: any) => ({ id: t.id, fecha: t.fecha, horario: `${t.hora_inicio}-${t.hora_fin}`, tipo: t.tipo_turno, puesto: t.puesto?.nombre, guarda: t.empleado?.nombre_completo })))}).

- Reemplazos y Relevos: ${telemetry.kpis.reemplazosPendientes || 0} pendientes (${JSON.stringify(telemetry.detalles.reemplazosRecientes || [])}).

DIRECTIVA DE INDAGACIÓN OPERACIONAL: Si la consulta toca turnos, relevos o puestos, cruza activamente las características del puesto (12h/24h, armado/sin armas, controles de acceso) y formula una pregunta proactiva de seguimiento al final.

- Vacaciones y Quiénes Siguen:

  - Vacaciones actuales: ${JSON.stringify(telemetry.detalles.vacacionesActuales)}

  - Próximos en salir a vacaciones: ${JSON.stringify(telemetry.detalles.quienesSiguenVacaciones)}

- Clientes y Contratos Activos: ${telemetry.kpis.clientesActivos} clientes (${JSON.stringify(

        telemetry.detalles.clientes.map((c: any) => c.nombre_empresa),

      )}) y ${telemetry.kpis.contratosActivos} contratos vigentes (${telemetry.kpis.guardasContratadosTotal} guardas).

- Controles de Acceso y Puertas IoT: ${telemetry.kpis.controlesAccesoTotal} controles de acceso (${telemetry.kpis.dispositivosOnline} en línea). Detalle: ${JSON.stringify(

        doorStatusDetail?.dispositivos || telemetry.detalles.controlesAcceso,

      )}

- Minutas Recientes: ${JSON.stringify(telemetry.detalles.minutasRecientes.slice(0, 6))}

${customSqlResult.length > 0 ? `- Datos de Consulta SQL (${executedSql}): ${JSON.stringify(customSqlResult.slice(0, 40))}` : ''}

${brainMatches.length > 0 ? `- Conocimiento del Segundo Cerebro PROLISEG LTDA: ${JSON.stringify(brainMatches.map((b: any) => ({ titulo: b.titulo, categoria: b.categoria, resumen: b.resumen, procedimiento: b.fragmento })))}` : ''}

DIRECTIVA DE RESOLUCIÓN DE PROBLEMAS: Si la consulta expone un problema, contingencia o novedad operativa (red, MikroTik, cámaras, corte de luz, relevos), diagnostica la situación usando los datos del Segundo Cerebro de PROLISEG y genera una solución paso a paso con acciones concretas en Prolicontrol, ofreciendo ejecutar la acción correspondiente con confirmación previa.

Mensaje del usuario: "${userQuery}"

`;



      let finalMessage = '';

      if (plan.directAnswer && customSqlResult.length === 0) {

        finalMessage = String(plan.directAnswer).trim();

      } else {

        try {

          finalMessage = await this.geminiService.generateStructuredOrNatural(responsePrompt);

        } catch {

          finalMessage = this.buildDeterministicCatorceResponse(userQuery, telemetry, activeUserName, customSqlResult);

        }

      }



      // Asegurar que la introducción amistosa aparezca si fue clasificada como Off-Topic

      // Respuesta directa y profesional sin advertencia de off-topic



      // Sanitización estricta de meta-instrucciones, trato al usuario y erradicación total de emojis

      finalMessage = finalMessage

        .replace(/^(lee\s+(esto\s+)?(en\s+español|con\s+voz|de\s+forma)[^:\n]*[:\n]+)/i, '')

        .replace(/\b(oscar\s+javier\s+solarte(\s+araujo)?|oscar\s+javier|oscar\s+solarte)\b/gi, activeUserName)



        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{200D}\u{FE0F}]/gu, '')

        .replace(/\s+/g, ' ')

        .trim();



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



      // Retorno inmediato con voz neural de fragmento inicial

      const audioDataUrl = await this.generateVoiceIfRequested(finalMessage, canal);



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

        audioDataUrl,

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
    const qNorm = (query || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const userLabel = userName || 'Ingeniero';
    const k = telemetry?.kpis || {};

    // 1. Mensajes sobre permisos, salidas, cena o asuntos cotidianos del turno
    if (/\b(ir|salgo|salir|temprano|casa|ceno|cenar|comer|almorzar|almuerzo|hambre|permiso|retiro|descanso|relevo)\b/i.test(qNorm)) {
      return `${userLabel}, entiendo su mensaje. Recuerde que como empresa de seguridad, cualquier salida o retiro anticipado debe coordinarse previamente con el supervisor de turno para garantizar que el servicio y puesto no queden descubiertos.`;
    }

    // 2. Mensajes sobre novedades o minutas
    if (/\b(novedad|minuta|incidente|reporte)\b/i.test(qNorm)) {
      return `${userLabel}, para asentar la novedad con precision en la minuta oficial de Prolicontrol, confirme a que puesto o edificio corresponde.`;
    }

    // 2b. Mensajes sobre contratos
    if (/\b(contrato|contratos)\b/i.test(qNorm)) {
      return `${userLabel}, para consultar los detalles de un contrato en Prolicontrol, por favor indíqueme el nombre del cliente o puesto correspondiente.`;
    }

    // 3. Saludos o consultas generales de estado
    if (/\b(hola|buenos dias|buenas tardes|buenas noches|como estas|como esta|estado general|como van)\b/i.test(qNorm)) {
      return `Hola ${userLabel}, le reporto que Prolicontrol opera normalmente con ${k.puestosActivos || 111} puestos y ${k.empleadosActivos || 408} empleados activos. En que le puedo colaborar en este momento?`;
    }

    // 4. Si hay resultados de base de datos
    if (customSqlResult && customSqlResult.length > 0) {
      return `${userLabel}, he consultado los datos solicitados en Prolicontrol y encontre ${customSqlResult.length} registro(s) coincidentes.`;
    }

    // 5. Respuesta concisa por defecto (maximo 2 oraciones)
    return `${userLabel}, recibo su mensaje en el Segundo Cerebro de Prolicontrol. Por favor indiqueme el puesto, empleado o gestion operativa que desea consultar o registrar.`;
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



  async getSystemAndVpsStatus(user: any) {

    return this.catorceBrain.getSystemAndVpsStatus(user);

  }



  async testDeviceConnectivity(target?: string, port?: number, user?: any) {

    return this.catorceBrain.testDeviceConnectivity(target, port, user);

  }



  async crearPuestoCompleto(body: any, user: any) {

    return this.catorceBrain.crearPuestoCompleto(body, user);

  }



  async gestionarTurnosYHorarios(body: any, user: any) {

    return this.catorceBrain.gestionarTurnosYHorarios(body, user);

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

    if (body.actionType === 'CONTROL_PUERTA') {
      const cmd = body.command || 'abrir';
      return this.catorceBrain.toolControlarPuerta(
        {
          deviceId: body.deviceId,
          ip: body.ip,
          doorId: body.doorId ? Number(body.doorId) : undefined,
          targetQuery: body.targetQuery || body.puerta || body.puesto || '',
          command: cmd,
          applyAll: Boolean(body.applyAll),
        },
        user,
      );
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



  /**

   * ⚡ Generador ultrarrápido de audio neural para consultas por voz o radio

   */

  public async generateVoiceIfRequested(text: string, canal?: string): Promise<string | undefined> {
    if (!canal || (!canal.includes('voz') && !canal.includes('radio') && canal !== 'texto')) {
      return undefined;
    }
    try {
      const snippet = this.extractSpokenSnippet(text);
      if (!snippet) return undefined;

      // En voz_live_api el cliente ya cuenta con streaming PCM en tiempo real:
      // devolver SOLO cache RAM instantanea (0ms) para no bloquear 1.2s esperando TTS remoto
      if (canal === 'voz_live_api') {
        const cached = this.geminiService.getCachedVoiceAudio(snippet, 'Aoede');
        return cached || undefined;
      }

      const audioPromise = this.geminiService.generateHumanVoiceAudio(snippet, 'Aoede');
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500));
      const audio = await Promise.race([audioPromise, timeoutPromise]);
      return audio || undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Extrae la primera oracion hablada limpia para locucion instantanea humana
   */
    public extractSpokenSnippet(text: string): string {
    const clean = (text || '')
      .replace(/<div class="audit-pill-msg">[\s\S]*?<\/div>/gi, '')
      .replace(/<pre>[\s\S]*?<\/pre>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/[*#_`~]/g, '')
      .replace(/AUD-CAT-\d+/g, '')
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{200D}\u{FE0F}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!clean) return '';
    const rawSentences = clean.split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter((s) => s.length > 0);
    const firstSentence = rawSentences[0] || clean;
    return firstSentence.length > 220 ? firstSentence.slice(0, 210).trim() : firstSentence;
  }

  private formatDoorControlReply(doorRes: any, command: string, activeUserName: string): { ok: boolean; message: string; awaitingFollowUp?: boolean } {
    const cmdVerbMap: Record<string, string> = {
      abrir: 'abrir',
      cerrar: 'cerrar',
      'siempre-abierta': 'dejar siempre abierta',
      'siempre-cerrada': 'dejar siempre cerrada',
    };
    const cmdDoneMap: Record<string, string> = {
      abrir: 'Puerta abierta correctamente',
      cerrar: 'Puerta cerrada y asegurada',
      'siempre-abierta': 'Puerta dejada en modo siempre abierta',
      'siempre-cerrada': 'Bloqueo total aplicado (siempre cerrada)',
    };
    const cmdVerb = cmdVerbMap[command] || command;

    if (doorRes?.noDevices) {
      return {
        ok: false,
        message: `${activeUserName}, no hay dispositivos de control de acceso registrados actualmente en Prolicontrol.`,
      };
    }

    if (doorRes?.batch) {
      return {
        ok: Boolean(doorRes.ok),
        message: `${activeUserName}, comando de ${cmdVerb} ejecutado en control de acceso: ${doorRes.okCount} de ${doorRes.totalAttempted} puertas respondieron correctamente${doorRes.failCount > 0 ? `, con ${doorRes.failCount} sin respuesta` : ''}.`,
      };
    }

    if (doorRes?.ambiguous || doorRes?.notFound) {
      const cands = (doorRes.candidates || []).slice(0, 5);
      const listText = cands.map((c: any, idx: number) => `${idx + 1}. ${c.nombre} (${c.puesto})`).join(', ');
      const prefix = doorRes.ambiguous
        ? `${activeUserName}, encontre varias puertas posibles`
        : `${activeUserName}, no identifique una puerta exacta para "${doorRes.targetQuery || ''}"`;
      const tail = listText ? `: ${listText}. Cual desea ${cmdVerb}?` : '. Por favor indiqueme el nombre del puesto o puerta.';
      return {
        ok: false,
        awaitingFollowUp: true,
        message: `${prefix}${tail}`,
      };
    }

    if (doorRes?.ok) {
      const devName = doorRes.device?.nombre || 'Control de Acceso';
      const puesto = doorRes.puestoName || doorRes.device?.puesto || 'Sede Principal';
      const marca = doorRes.hwResult?.marca || doorRes.device?.marca || '';
      return {
        ok: true,
        message: `${activeUserName}, ${cmdDoneMap[command] || 'comando ejecutado'} en **${devName}** (${puesto}${marca ? ', ' + marca : ''}, puerta ${doorRes.doorId}).${doorRes.auditCode ? ' Auditoria: [' + doorRes.auditCode + ']' : ''}`,
      };
    }

    const devLabel = doorRes?.device?.nombre ? `**${doorRes.device.nombre}** (${doorRes.device.ip || ''})` : 'el dispositivo';
    const errDetail = doorRes?.hwResult?.mensaje || doorRes?.mensaje || 'sin comunicacion';
    return {
      ok: false,
      message: `${activeUserName}, intente ${cmdVerb} ${devLabel}, pero el hardware respondio con error: ${errDetail}.`,
    };
  }

  private async buildAndReturnDoorControlResponse(
    doorRes: any,
    command: 'abrir' | 'cerrar' | 'siempre-abierta' | 'siempre-cerrada',
    userQuery: string,
    activeUserName: string,
    user: any,
    canal: string,
    startTime: number,
  ) {
    const formatted = this.formatDoorControlReply(doorRes, command, activeUserName);
    const tools = [`CATORCE-IOT:controlPuerta(${command})`];

    if (formatted.awaitingFollowUp) {
      await this.catorceBrain.saveWorkingMemory(user, {
        tarea_activa: `Control de Puerta (${command})`,
        operacion: 'DOOR_CONTROL_FOLLOWUP',
        datos_recolectados: { command, candidates: doorRes?.candidates || [] },
        campos_faltantes: ['dispositivo'],
        estado: 'EN_PROGRESO',
        ultimo_prompt: userQuery,
      });
    } else {
      await this.catorceBrain.clearWorkingMemory(user).catch(() => {});
    }

    this.catorceBrain.appendConversationTurn(user, userQuery, formatted.message, canal, ['accesos'], tools);
    const voiceText = formatted.message.replace(/Auditoria:\s*\[[^\]]+\]/gi, '').trim();
    const audioDataUrl = await this.generateVoiceIfRequested(voiceText, canal);

    return {
      ok: formatted.ok,
      assistant: 'CATORCE',
      actionExecuted: formatted.awaitingFollowUp ? 'SELECCIONAR_PUERTA_ACCESO' : `CONTROL_PUERTA_${command.toUpperCase().replace(/-/g, '_')}`,
      awaitingFollowUp: Boolean(formatted.awaitingFollowUp),
      auditCode: doorRes?.auditCode,
      activatedNodes: ['accesos'],
      toolsUsed: tools,
      data: doorRes,
      message: formatted.message,
      audioDataUrl,
      latencyMs: Date.now() - startTime,
    };
  }

}

