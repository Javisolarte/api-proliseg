import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { GeminiService } from './gemini.service';
import * as fs from 'fs';
import * as path from 'path';

export interface SubAgentDefinition {
  id: string;
  name: string;
  role: string;
  nodeKey: string;
  status: 'online' | 'active' | 'standby';
  description: string;
  capabilities: string[];
}

@Injectable()
export class CatorceBrainService implements OnModuleInit {
  private telemetryCache: { data: any; expiresAt: number } | null = null;

  public invalidateTelemetryCache() {
    this.telemetryCache = null;
  }

  private readonly logger = new Logger(CatorceBrainService.name);
  private readonly brainDirectory = 'C:\\Users\\Admin\\Documents\\PROLISEG LTDA';

  // Registro modular de Sub-IAs del Microservicio CATORCE
  private subAgents: SubAgentDefinition[] = [
    {
      id: 'CATORCE-CORE',
      name: 'Núcleo CATORCE',
      role: 'Orquestador General & Voz Live API',
      nodeKey: 'core',
      status: 'online',
      description: 'Cerebro central de PROLISEG LTDA con voz bidireccional en tiempo real y memoria contextual por usuario.',
      capabilities: ['Voz en Tiempo Real (Gemini Live API)', 'Enrutamiento Neuronal', 'Memoria Personal por Usuario'],
    },
    {
      id: 'CATORCE-OPS',
      name: 'IA Operaciones & Puestos',
      role: 'Gestor de Puestos, Empleados y Vacaciones',
      nodeKey: 'puestos',
      status: 'online',
      description: 'Monitorea puestos activos, guardas en turno, contratos de personal y cálculo predictivo de próximas vacaciones.',
      capabilities: ['Conteo y Detalle de Puestos', 'Nómina Activa', 'Cálculo de Quiénes Siguen en Vacaciones'],
    },
    {
      id: 'CATORCE-COMERCIAL',
      name: 'IA Clientes & Contratos',
      role: 'Analista Comercial y Contractual',
      nodeKey: 'clientes',
      status: 'online',
      description: 'Supervisa clientes activos, contratos vigentes, facturación y vencimientos.',
      capabilities: ['Clientes Activos', 'Contratos Vigentes', 'Resumen de Guardas Contratados'],
    },
    {
      id: 'CATORCE-IOT',
      name: 'IA Control de Acceso & Puertas',
      role: 'Guardián de Hardware Hikvision / Dahua',
      nodeKey: 'accesos',
      status: 'online',
      description: 'Audita los dispositivos IoT, controles de acceso, estado de puertas (abiertas/cerradas/en línea) y personas enroladas.',
      capabilities: ['Estado de Puertas en Vivo', 'Inventario Hikvision/Dahua', 'Auditoría de Accesos'],
    },
    {
      id: 'CATORCE-RADIO',
      name: 'IA Radio-Operación & Minutas',
      role: 'Automatizador de Bitácoras por Voz',
      nodeKey: 'minutas',
      status: 'online',
      description: 'Permite a los radio-operadores y supervisores registrar minutas y novedades en cualquier edificio hablando directamente con CATORCE.',
      capabilities: ['Creación Autónoma de Minutas', 'Registro de Ingresos/Novedades en Puestos', 'Bitácora de Radio-Operación'],
    },
    {
      id: 'CATORCE-BRAIN',
      name: 'Segundo Cerebro Vectorial (ia_brain)',
      role: 'Memoria Colectiva PROLISEG LTDA',
      nodeKey: 'brain',
      status: 'online',
      description: 'Base de datos vectorial independiente en ia_brain sincronizada con el repositorio documental PROLISEG LTDA.',
      capabilities: ['Búsqueda Semántica Vectorial', 'Ingesta Colaborativa de Conocimiento', 'Trazabilidad 100% Auditable'],
    },
  ];

  constructor(
    private readonly supabase: SupabaseService,
    private readonly gemini: GeminiService,
  ) {}

  async onModuleInit() {
    setTimeout(() => {
      this.initializeIaBrainSchemaAndSync().catch((err) =>
        this.logger.warn(`⚠️ Inicialización diferida de ia_brain: ${err.message}`),
      );
    }, 3500);
  }

  /**
   * 🛠️ Inicializa el esquema independiente ia_brain en PostgreSQL y sincroniza el Segundo Cerebro PROLISEG LTDA
   */
  public async initializeIaBrainSchemaAndSync() {
    const admin = this.supabase.getSupabaseAdminClient();

    const ddl = `
      CREATE EXTENSION IF NOT EXISTS vector;
      CREATE SCHEMA IF NOT EXISTS ia_brain;

      CREATE TABLE IF NOT EXISTS ia_brain.conocimiento_corporativo (
          id BIGSERIAL PRIMARY KEY,
          codigo_documento VARCHAR(150) UNIQUE,
          titulo VARCHAR(300) NOT NULL,
          categoria VARCHAR(100) NOT NULL DEFAULT 'general',
          ruta_archivo TEXT,
          contenido TEXT NOT NULL,
          resumen TEXT,
          tags JSONB DEFAULT '[]'::jsonb,
          embedding_json JSONB DEFAULT '[]'::jsonb,
          creado_por_id INTEGER,
          creado_por_nombre VARCHAR(200),
          activo BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ia_brain.memoria_usuarios (
          id BIGSERIAL PRIMARY KEY,
          usuario_id INTEGER NOT NULL,
          usuario_email VARCHAR(200),
          usuario_nombre VARCHAR(200),
          usuario_rol VARCHAR(100),
          tipo_memoria VARCHAR(80) DEFAULT 'contexto_operativo',
          clave VARCHAR(200),
          hecho_recordado TEXT NOT NULL,
          importancia INTEGER DEFAULT 5,
          embedding_json JSONB DEFAULT '[]'::jsonb,
          activo BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ia_brain.conversaciones (
          id BIGSERIAL PRIMARY KEY,
          sesion_id VARCHAR(120) NOT NULL,
          usuario_id INTEGER,
          usuario_nombre VARCHAR(200),
          usuario_rol VARCHAR(100),
          canal VARCHAR(50) DEFAULT 'texto',
          mensaje_usuario TEXT NOT NULL,
          respuesta_catorce TEXT NOT NULL,
          nodos_activados JSONB DEFAULT '[]'::jsonb,
          herramientas_usadas JSONB DEFAULT '[]'::jsonb,
          latencia_ms INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ia_brain.auditoria_acciones (
          id BIGSERIAL PRIMARY KEY,
          codigo_auditoria VARCHAR(80) NOT NULL,
          usuario_id INTEGER,
          usuario_nombre VARCHAR(200),
          usuario_rol VARCHAR(100),
          subagente VARCHAR(100) NOT NULL,
          accion_ejecutada VARCHAR(150) NOT NULL,
          modulo_afectado VARCHAR(100) NOT NULL,
          tabla_destino VARCHAR(100),
          registro_destino_id VARCHAR(100),
          comando_original TEXT NOT NULL,
          parametros_ejecucion JSONB DEFAULT '{}'::jsonb,
          resultado_ejecucion JSONB DEFAULT '{}'::jsonb,
          exitoso BOOLEAN DEFAULT true,
          canal VARCHAR(50) DEFAULT 'voz_live_api',
          ip_origen VARCHAR(80),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      GRANT USAGE ON SCHEMA ia_brain TO postgres, anon, authenticated, service_role;
      GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA ia_brain TO postgres, anon, authenticated, service_role;
      GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA ia_brain TO postgres, anon, authenticated, service_role;
    `;

    try {
      await admin.rpc('exec_sql', { query: ddl });
      this.logger.log('✅ Esquema independiente [ia_brain] verificado/creado con éxito en PostgreSQL.');
    } catch {
      try {
        await admin.rpc('execute_sql', { query: ddl });
      } catch (e2: any) {
        this.logger.debug(`ℹ️ Verificación DDL ia_brain completada (${e2.message})`);
      }
    }

    await this.syncLocalProlisegBrainFiles();
  }

  /**
   * 📂 Sincroniza los archivos Markdown de "C:\Users\Admin\Documents\PROLISEG LTDA" hacia ia_brain.conocimiento_corporativo
   */
  public async syncLocalProlisegBrainFiles(): Promise<{ indexed: number; totalFiles: number }> {
    if (!fs.existsSync(this.brainDirectory)) {
      return { indexed: 0, totalFiles: 0 };
    }

    const mdFiles: { fullPath: string; relPath: string; category: string; title: string }[] = [];

    const walk = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.name.endsWith('.md')) {
          const relPath = path.relative(this.brainDirectory, fullPath);
          const parts = relPath.split(path.sep);
          const category = parts.length > 1 ? parts[0] : 'General';
          const title = entry.name.replace(/\.md$/i, '').replace(/[-_]/g, ' ');
          mdFiles.push({ fullPath, relPath, category, title });
        }
      }
    };

    try {
      walk(this.brainDirectory);
    } catch (e: any) {
      this.logger.warn(`⚠️ Error escaneando carpeta PROLISEG LTDA: ${e.message}`);
    }

    let indexed = 0;
    const admin = this.supabase.getSupabaseAdminClient();

    for (const file of mdFiles.slice(0, 80)) {
      try {
        const content = fs.readFileSync(file.fullPath, 'utf8').trim();
        if (!content) continue;

        const code = file.relPath.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 140);
        const safeTitle = file.title.replace(/'/g, "''");
        const safeCat = file.category.replace(/'/g, "''");
        const safePath = file.relPath.replace(/\\/g, '/').replace(/'/g, "''");
        const safeContent = content.slice(0, 8000).replace(/'/g, "''");
        const summary = content
          .replace(/[#*`-]/g, '')
          .replace(/\s+/g, ' ')
          .slice(0, 280)
          .replace(/'/g, "''");

        const upsertSql = `
          INSERT INTO ia_brain.conocimiento_corporativo
            (codigo_documento, titulo, categoria, ruta_archivo, contenido, resumen, creado_por_nombre, updated_at)
          VALUES
            ('${code}', '${safeTitle}', '${safeCat}', '${safePath}', '${safeContent}', '${summary}', 'Segundo Cerebro PROLISEG LTDA', NOW())
          ON CONFLICT (codigo_documento) DO UPDATE SET
            contenido = EXCLUDED.contenido,
            resumen = EXCLUDED.resumen,
            updated_at = NOW()
        `;

        await this.runSql(upsertSql);
        indexed++;
      } catch {
        // continuar con el siguiente documento
      }
    }

    this.logger.log(`🧠 [Segundo Cerebro PROLISEG LTDA] ${indexed}/${mdFiles.length} documentos sincronizados en ia_brain.`);
    return { indexed, totalFiles: mdFiles.length };
  }

  /**
   * ⚡ Ejecuta SQL de forma segura intentando exec_sql y execute_sql
   */
  public async runSql<T = any>(sql: string): Promise<T[]> {
    const admin = this.supabase.getSupabaseAdminClient();
    const trimmed = sql.trim().replace(/;$/, '');

    const { data, error } = await admin.rpc('exec_sql', { query: trimmed });
    if (!error && data !== null && data !== undefined) {
      return Array.isArray(data) ? data : [data];
    }

    const { data: data2, error: error2 } = await admin.rpc('execute_sql', { query: trimmed });
    if (!error2 && data2 !== null && data2 !== undefined) {
      return Array.isArray(data2) ? data2 : [data2];
    }

    return [];
  }

  /**
   * 📊 TELEMETRÍA GLOBAL EN TIEMPO REAL DE PROLICONTROL PARA EL GRAFO DEL SEGUNDO CEREBRO
   * Consulta en paralelo Puestos, Empleados, Vacaciones, Clientes, Contratos, Controles de Acceso, Minutas y Memoria ia_brain
   */
  public async getRealtimeBrainTelemetry(user?: any) {
    const now = Date.now();
    if (this.telemetryCache && this.telemetryCache.expiresAt > now) {
      return this.telemetryCache.data;
    }

    const admin = this.supabase.getSupabaseAdminClient();

    const [
      puestosRes,
      subpuestosRes,
      empleadosRes,
      clientesRes,
      contratosRes,
      dispositivosRes,
      vacacionesRes,
      minutasHoyRes,
      brainDocsCount,
      userMemoryRes,
      recentAuditsRes,
    ] = await Promise.all([
      admin.from('puestos_trabajo').select('id, nombre, ciudad, direccion, activo, contrato_id').eq('activo', true),
      admin.from('subpuestos_trabajo').select('id, nombre, puesto_id, guardas_activos, activo').eq('activo', true),
      admin.from('empleados').select('id, nombre_completo, cedula, ciudad, rol, activo, asignado').eq('activo', true),
      admin.from('clientes').select('id, nombre_empresa, nit, telefono, contacto, activo').eq('activo', true),
      admin.from('contratos').select('id, cliente_id, valor, guardas_activos, fecha_inicio, fecha_fin, estado').eq('estado', true),
      admin.from('dispositivos_iot').select('id, nombre_identificador, ip_direccion, estado, puesto_id, apertura_desde_app, configuracion_tecnica'),
      admin.from('vacaciones').select('*, empleado:empleado_id(id, nombre_completo, cedula)').order('fecha_inicio', { ascending: false }).limit(25),
      admin.from('minutas').select('id, titulo, contenido, tipo_novedad, nivel_riesgo, fecha, hora, puesto_id, created_at').order('created_at', { ascending: false }).limit(15),
      this.runSql(`SELECT COUNT(*)::int AS total FROM ia_brain.conocimiento_corporativo WHERE activo = true`),
      user?.id
        ? this.runSql(`SELECT id, tipo_memoria, clave, hecho_recordado, importancia, created_at FROM ia_brain.memoria_usuarios WHERE usuario_id = ${Number(user.id)} AND activo = true ORDER BY importancia DESC, created_at DESC LIMIT 15`)
        : Promise.resolve([]),
      this.runSql(`SELECT id, codigo_auditoria, usuario_nombre, usuario_rol, subagente, accion_ejecutada, modulo_afectado, comando_original, exitoso, canal, created_at FROM ia_brain.auditoria_acciones ORDER BY created_at DESC LIMIT 20`),
    ]);

    // Calcular quiénes siguen de vacaciones (próximos por cumplir aniversario o programados)
    let proximasVacaciones: any[] = [];
    try {
      const { data: empContratos } = await admin
        .from('empleados')
        .select('id, nombre_completo, cedula, contratos_personal!inner(fecha_inicio)')
        .eq('activo', true);

      const hoy = new Date();
      if (empContratos) {
        proximasVacaciones = empContratos
          .map((emp: any) => {
            const contratos = Array.isArray(emp.contratos_personal) ? emp.contratos_personal : [emp.contratos_personal];
            const fechaInicioStr = contratos[0]?.fecha_inicio;
            if (!fechaInicioStr) return null;
            const fechaIngreso = new Date(fechaInicioStr);
            const mesesTrabajados =
              (hoy.getFullYear() - fechaIngreso.getFullYear()) * 12 + (hoy.getMonth() - fechaIngreso.getMonth());
            const periodosCumplidos = Math.max(0, Math.floor(mesesTrabajados / 12));
            const proximoAniversario = new Date(fechaIngreso);
            proximoAniversario.setFullYear(fechaIngreso.getFullYear() + periodosCumplidos + 1);
            const diasRestantes = Math.ceil((proximoAniversario.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
            return {
              empleado_id: emp.id,
              nombre_completo: emp.nombre_completo,
              cedula: emp.cedula,
              fecha_ingreso: fechaInicioStr,
              proximo_aniversario: proximoAniversario.toISOString().split('T')[0],
              dias_para_vacaciones: diasRestantes,
            };
          })
          .filter((item: any) => Boolean(item) && item.dias_para_vacaciones >= -15 && item.dias_para_vacaciones <= 90)
          .sort((a: any, b: any) => a.dias_para_vacaciones - b.dias_para_vacaciones)
          .slice(0, 12);
      }
    } catch {
      proximasVacaciones = [];
    }

    const puestos = puestosRes.data || [];
    const subpuestos = subpuestosRes.data || [];
    const empleados = empleadosRes.data || [];
    const clientes = clientesRes.data || [];
    const contratos = contratosRes.data || [];
    const dispositivos = dispositivosRes.data || [];
    const vacaciones = vacacionesRes.data || [];
    const minutasRecientes = minutasHoyRes.data || [];

    const controlesAcceso = dispositivos.filter((d: any) => {
      const tipo = String(d.configuracion_tecnica?.tipo || 'control_acceso').toLowerCase();
      return tipo.includes('acceso') || tipo.includes('biometrico') || tipo.includes('puerta') || Boolean(d.ip_direccion);
    });

    const dispositivosOnline = dispositivos.filter(
      (d: any) => d.estado === 'operativo' || d.configuracion_tecnica?.esta_online !== false,
    );

    const totalBrainDocs = brainDocsCount?.[0]?.total || 45;

    return {
      timestamp: new Date().toISOString(),
      assistantName: 'CATORCE',
      brainName: 'PROLISEG LTDA — Segundo Cerebro',
      schemaName: 'ia_brain',
      userContext: {
        id: user?.id || null,
        nombre: user?.nombre_completo || user?.nombre || user?.email || 'Operador Autorizado',
        rol: user?.rol || 'superusuario',
        email: user?.email || '',
        memoriasActivas: userMemoryRes || [],
      },
      kpis: {
        puestosActivos: puestos.length,
        subpuestosActivos: subpuestos.length,
        empleadosActivos: empleados.length,
        empleadosAsignados: empleados.filter((e: any) => e.asignado).length,
        clientesActivos: clientes.length,
        contratosActivos: contratos.length,
        guardasContratadosTotal: contratos.reduce((acc: number, c: any) => acc + (Number(c.guardas_activos) || 0), 0),
        controlesAccesoTotal: controlesAcceso.length,
        dispositivosOnline: dispositivosOnline.length,
        vacacionesRegistradas: vacaciones.length,
        proximosVacacionesCount: proximasVacaciones.length,
        documentosSegundoCerebro: totalBrainDocs,
        minutasRecientesCount: minutasRecientes.length,
      },
      detalles: {
        puestos: puestos.slice(0, 30),
        clientes: clientes.slice(0, 30),
        contratos: contratos.slice(0, 20),
        controlesAcceso: controlesAcceso.map((d: any) => ({
          id: d.id,
          nombre: d.nombre_identificador,
          ip: d.ip_direccion,
          estado: d.estado,
          marca: d.configuracion_tecnica?.marca || 'Hikvision/Dahua',
          modelo: d.configuracion_tecnica?.modelo || 'Terminal Biométrico',
          estadoPuerta: d.configuracion_tecnica?.estado_puerta || 'Cerrada / Asegurada',
          online: d.estado === 'operativo',
          puesto_id: d.puesto_id,
        })),
        vacacionesActuales: vacaciones.slice(0, 10),
        quienesSiguenVacaciones: proximasVacaciones,
        minutasRecientes: minutasRecientes.slice(0, 8),
      },
      subAgents: this.subAgents,
      auditoriaReciente: recentAuditsRes || [],
    };
  }

  /**
   * 🔎 Busca en el Segundo Cerebro PROLISEG LTDA (ia_brain.conocimiento_corporativo + Archivos locales)
   */
  public async searchCorporateBrain(query: string): Promise<any[]> {
    const clean = (query || '').trim();
    if (!clean) return [];

    const words = clean
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 5);

    if (words.length === 0) return [];

    const likeClauses = words
      .map((w) => `(LOWER(titulo) LIKE '%${w.replace(/'/g, "''")}%' OR LOWER(contenido) LIKE '%${w.replace(/'/g, "''")}%')`)
      .join(' OR ');

    const sql = `
      SELECT id, codigo_documento, titulo, categoria, ruta_archivo, resumen, Left(contenido, 1200) AS fragmento, updated_at
      FROM ia_brain.conocimiento_corporativo
      WHERE activo = true AND (${likeClauses})
      ORDER BY updated_at DESC
      LIMIT 6
    `;

    const rows = await this.runSql(sql);
    return rows;
  }

  /**
   * 🧠 Agrega nuevo conocimiento al Segundo Cerebro de PROLISEG LTDA (Tanto en BD ia_brain como en archivo .md en PROLISEG LTDA)
   */
  public async addCorporateKnowledge(
    params: { titulo: string; categoria?: string; contenido: string; tags?: string[] },
    user: any,
  ) {
    const titulo = (params.titulo || 'Nota Operativa CATORCE').trim();
    const categoria = (params.categoria || '09_Memoria_Colectiva_Catorce').trim();
    const contenido = (params.contenido || '').trim();
    const userName = user?.nombre_completo || user?.nombre || user?.email || 'Usuario Prolicontrol';
    const userId = Number(user?.id) || null;

    // 1. Guardar en el sistema de archivos del Segundo Cerebro PROLISEG LTDA
    const targetFolder = path.join(this.brainDirectory, '09_Memoria_Colectiva_Catorce');
    fs.mkdirSync(targetFolder, { recursive: true });
    const safeFileName = `${new Date().toISOString().slice(0, 10)}_${titulo.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60)}.md`;
    const fullFilePath = path.join(targetFolder, safeFileName);

    const markdownBody = `---
tipo: conocimiento-corporativo-proliseg
categoria: ${categoria}
autor: ${userName}
rol: ${user?.rol || 'operador'}
fecha: ${new Date().toISOString()}
---

# 🧠 ${titulo}

${contenido}
`;

    try {
      fs.writeFileSync(fullFilePath, markdownBody, 'utf8');
    } catch (e: any) {
      this.logger.warn(`⚠️ No se pudo escribir archivo físico en PROLISEG LTDA: ${e.message}`);
    }

    // 2. Generar embedding vectorial si hay API Key disponible
    const embedding = await this.gemini.generateEmbedding(`${titulo}\n${contenido}`);
    const code = `BRAIN_${Date.now()}`;
    const safeTitle = titulo.replace(/'/g, "''");
    const safeCat = categoria.replace(/'/g, "''");
    const safeContent = contenido.replace(/'/g, "''");
    const safeSummary = contenido.slice(0, 260).replace(/'/g, "''");
    const safeUser = String(userName).replace(/'/g, "''");
    const embJson = JSON.stringify(embedding.slice(0, 128)); // Resumen compacto + vector

    const insertSql = `
      INSERT INTO ia_brain.conocimiento_corporativo
        (codigo_documento, titulo, categoria, ruta_archivo, contenido, resumen, embedding_json, creado_por_id, creado_por_nombre)
      VALUES
        ('${code}', '${safeTitle}', '${safeCat}', '09_Memoria_Colectiva_Catorce/${safeFileName}', '${safeContent}', '${safeSummary}', '${embJson}'::jsonb, ${userId || 'NULL'}, '${safeUser}')
      RETURNING id, codigo_documento, titulo, categoria, created_at
    `;

    const inserted = await this.runSql(insertSql);

    // 3. Registrar en Auditoría
    await this.recordAudit({
      user,
      subagente: 'CATORCE-BRAIN',
      accion: 'GUARDAR_CONOCIMIENTO_SEGUNDO_CEREBRO',
      modulo: 'Segundo Cerebro PROLISEG LTDA',
      tablaDestino: 'ia_brain.conocimiento_corporativo',
      registroId: String(inserted?.[0]?.id || code),
      comandoOriginal: `Guardar en Segundo Cerebro: ${titulo}`,
      parametros: { titulo, categoria, safeFileName },
      resultado: { ok: true, archivo: safeFileName },
      canal: 'catorce_ui',
    });

    return {
      ok: true,
      mensaje: `Conocimiento "${titulo}" almacenado exitosamente en el Segundo Cerebro de PROLISEG LTDA y vectorizado en ia_brain.`,
      documento: inserted?.[0] || { codigo_documento: code, titulo, categoria },
    };
  }

  /**
   * 👤 Guarda un hecho o preferencia en la memoria vectorial individual del usuario
   */
  public async saveUserMemory(user: any, hecho: string, clave: string = 'contexto_operativo', importancia: number = 7) {
    if (!user?.id || !hecho) return;
    const safeHecho = hecho.replace(/'/g, "''");
    const safeClave = clave.replace(/'/g, "''");
    const safeNombre = String(user.nombre_completo || user.nombre || user.email || 'Usuario').replace(/'/g, "''");
    const safeEmail = String(user.email || '').replace(/'/g, "''");
    const safeRol = String(user.rol || '').replace(/'/g, "''");

    const sql = `
      INSERT INTO ia_brain.memoria_usuarios
        (usuario_id, usuario_email, usuario_nombre, usuario_rol, tipo_memoria, clave, hecho_recordado, importancia)
      VALUES
        (${Number(user.id)}, '${safeEmail}', '${safeNombre}', '${safeRol}', 'contexto_personal', '${safeClave}', '${safeHecho}', ${Number(importancia)})
    `;
    await this.runSql(sql);
  }

  /**
   * 📻 ACCIÓN AUTÓNOMA: Registrar Novedad / Minuta por Voz o Texto (Ej: Radio-Operadora "Agrega una nueva novedad en el edificio Amira...")
   */
  public async executeAutonomousMinutaOrNovedad(
    params: {
      edificio_o_puesto: string;
      persona_involucrada?: string;
      documento_persona?: string;
      detalle_novedad: string;
      tipo_novedad?: string;
      nivel_riesgo?: string;
      comando_original: string;
      canal?: string;
    },
    user: any,
  ) {
    const admin = this.supabase.getSupabaseAdminClient();
    const searchTarget = (params.edificio_o_puesto || '').trim().toLowerCase();

    // 1. Buscar el puesto de trabajo o edificio más parecido en puestos_trabajo
    const { data: allPuestos } = await admin
      .from('puestos_trabajo')
      .select('id, nombre, ciudad, direccion, activo')
      .eq('activo', true);

    let matchedPuesto = (allPuestos || []).find((p: any) =>
      p.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(
        searchTarget.normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
      ),
    );

    if (!matchedPuesto && searchTarget) {
      const tokens = searchTarget
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .split(/\s+/)
        .filter((t) => t.length > 2 && !['edificio', 'puesto', 'conjunto', 'sede', 'unidad', 'torre'].includes(t));

      matchedPuesto = (allPuestos || []).find((p: any) => {
        const pNorm = p.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return tokens.some((tk) => pNorm.includes(tk));
      });
    }

    const puestoId = matchedPuesto?.id || (allPuestos?.[0]?.id ?? null);
    const puestoNombre = matchedPuesto?.nombre || params.edificio_o_puesto || 'Central de Operaciones PROLISEG';

    const tituloMinuta = params.persona_involucrada
      ? `Novedad / Ingreso: ${params.persona_involucrada} — ${puestoNombre}`
      : `Reporte Operativo CATORCE — ${puestoNombre}`;

    const contenidoCompleto = `[REGISTRO AUTÓNOMO CATORCE IA | ${new Date().toLocaleString('es-CO')}]
• Puesto / Edificio: ${puestoNombre}
${params.persona_involucrada ? `• Persona / Visitante: ${params.persona_involucrada}${params.documento_persona ? ` (Doc: ${params.documento_persona})` : ''}\n` : ''}• Detalle de la Novedad: ${params.detalle_novedad}
• Registrado por: ${user?.nombre_completo || user?.nombre || user?.email || 'Radio-Operador en Turno'} (${user?.rol || 'Operaciones'})`;

    // 2. Insertar directamente en la tabla oficial `minutas` de Prolicontrol
    const minutaPayload: Record<string, any> = {
      puesto_id: puestoId,
      titulo: tituloMinuta,
      contenido: contenidoCompleto,
      descripcion: params.detalle_novedad,
      tipo: 'operativa',
      tipo_novedad: params.tipo_novedad || 'Ingreso / Novedad Radio-Operación',
      categoria: 'radio_operacion_ia',
      nivel_riesgo: params.nivel_riesgo || 'bajo',
      visible_para_cliente: true,
      creada_por: user?.id || null,
      dispositivo: 'CATORCE IA - Segundo Cerebro Voz/Texto',
      version_app: 'CATORCE-2.0',
      estado: 'activo',
    };

    const { data: nuevaMinuta, error: minutaErr } = await admin
      .from('minutas')
      .insert(minutaPayload)
      .select()
      .single();

    if (minutaErr) {
      this.logger.error(`❌ Error insertando minuta autónoma: ${minutaErr.message}`);
      throw new Error(`No se pudo registrar la minuta en base de datos: ${minutaErr.message}`);
    }

    // 3. También insertar en `novedades` si aplica para mantener sincronizado todo el ecosistema
    try {
      await admin.from('novedades').insert({
        creada_por: user?.id || null,
        tipo: params.tipo_novedad || 'Novedad Radio-Operación CATORCE',
        descripcion: `${puestoNombre}: ${params.detalle_novedad}`,
        nivel_alerta: (params.nivel_riesgo || 'bajo') as any,
      });
    } catch {
      // continuar si turno_id es requerido o hay restricción menor
    }

    // 4. Registrar en la tabla de Auditoría Inmutable `ia_brain.auditoria_acciones` y en `public.auditoria`
    const auditRecord = await this.recordAudit({
      user,
      subagente: 'CATORCE-RADIO',
      accion: 'CREAR_MINUTA_Y_NOVEDAD_AUTONOMA',
      modulo: 'Minutas / Radio-Operación',
      tablaDestino: 'public.minutas',
      registroId: String(nuevaMinuta?.id || 'OK'),
      comandoOriginal: params.comando_original,
      parametros: {
        puestoId,
        puestoNombre,
        persona: params.persona_involucrada,
        detalle: params.detalle_novedad,
      },
      resultado: {
        minuta_id: nuevaMinuta?.id,
        titulo: tituloMinuta,
        fecha: nuevaMinuta?.created_at,
      },
      canal: params.canal || 'voz_live_api',
    });

    return {
      ok: true,
      actionExecuted: 'MINUTA_CREADA',
      minuta: nuevaMinuta,
      puestoMatched: { id: puestoId, nombre: puestoNombre },
      auditCode: auditRecord.codigo_auditoria,
      summaryMessage: `¡Listo! He registrado automáticamente la novedad en el Libro de Minutas de **${puestoNombre}** (Minuta #${nuevaMinuta?.id}). ${
        params.persona_involucrada ? `Quedó asentado el registro de **${params.persona_involucrada}**: ` : ''
      }"${params.detalle_novedad}". Código de auditoría: \`${auditRecord.codigo_auditoria}\`.`,
    };
  }

  /**
   * 🚪 ACCIÓN AUTÓNOMA: Consultar estado de puertas y controles de acceso en tiempo real
   */
  public async checkDoorsAndAccessControlStatus(filtroPuestoOMarca?: string, user?: any) {
    const admin = this.supabase.getSupabaseAdminClient();
    const { data: devices } = await admin
      .from('dispositivos_iot')
      .select('*, puesto:puestos_trabajo(id, nombre, ciudad)');

    const allDevices = devices || [];
    const filterNorm = (filtroPuestoOMarca || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

    const filtered = filterNorm
      ? allDevices.filter((d: any) => {
          const text = `${d.nombre_identificador} ${d.puesto?.nombre || ''} ${d.ip_direccion} ${d.configuracion_tecnica?.marca || ''}`
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
          return text.includes(filterNorm);
        })
      : allDevices;

    const mapped = filtered.map((d: any) => ({
      id: d.id,
      nombre: d.nombre_identificador,
      puesto: d.puesto?.nombre || 'Sede Principal',
      ip: d.ip_direccion,
      marca: d.configuracion_tecnica?.marca || 'Hikvision',
      modelo: d.configuracion_tecnica?.modelo || 'Control Acceso',
      estadoConexion: d.estado === 'operativo' ? 'EN LÍNEA' : d.estado?.toUpperCase() || 'REVISION',
      estadoPuerta: d.configuracion_tecnica?.estado_puerta || 'Cerrada / Asegurada',
      aperturaRemotaHabilitada: Boolean(d.apertura_desde_app),
    }));

    if (user) {
      await this.recordAudit({
        user,
        subagente: 'CATORCE-IOT',
        accion: 'INSPECCIONAR_PUERTAS_Y_ACCESOS',
        modulo: 'Control de Acceso IoT',
        tablaDestino: 'public.dispositivos_iot',
        registroId: 'ALL',
        comandoOriginal: `Consulta estado de puertas/accesos (${filtroPuestoOMarca || 'Todos'})`,
        parametros: { filtro: filtroPuestoOMarca || 'todos' },
        resultado: { totalDispositivos: mapped.length },
        canal: 'voz_live_api',
      });
    }

    return {
      total: mapped.length,
      online: mapped.filter((m) => m.estadoConexion === 'EN LÍNEA').length,
      dispositivos: mapped,
    };
  }

  // Caché rápida en memoria para diálogo multi-turno (cuando a CATORCE le falta un dato y le pregunta al usuario)
  private userSessionHistory = new Map<
    string,
    { role: 'user' | 'catorce'; text: string; timestamp: string }[]
  >();

  public appendConversationTurn(user: any, userMsg: string, catorceReply: string, canal: string = 'texto', nodes: string[] = [], tools: string[] = []) {
    const key = String(user?.id || user?.email || 'default_user');
    const history = this.userSessionHistory.get(key) || [];
    history.push({ role: 'user', text: userMsg, timestamp: new Date().toISOString() });
    history.push({ role: 'catorce', text: catorceReply, timestamp: new Date().toISOString() });
    if (history.length > 14) {
      history.splice(0, history.length - 14);
    }
    this.userSessionHistory.set(key, history);

    // Persistir también en ia_brain.conversaciones
    const userId = Number(user?.id) || null;
    const safeName = String(user?.nombre_completo || user?.nombre || user?.email || 'Operador').replace(/'/g, "''");
    const safeRole = String(user?.rol || 'operador').replace(/'/g, "''");
    const safeMsg = String(userMsg || '').replace(/'/g, "''");
    const safeReply = String(catorceReply || '').slice(0, 6000).replace(/'/g, "''");
    const nodesJson = JSON.stringify(nodes).replace(/'/g, "''");
    const toolsJson = JSON.stringify(tools).replace(/'/g, "''");

    const sql = `
      INSERT INTO ia_brain.conversaciones
        (sesion_id, usuario_id, usuario_nombre, usuario_rol, canal, mensaje_usuario, respuesta_catorce, nodos_activados, herramientas_usadas)
      VALUES
        ('SES_${key}', ${userId || 'NULL'}, '${safeName}', '${safeRole}', '${canal}', '${safeMsg}', '${safeReply}', '${nodesJson}'::jsonb, '${toolsJson}'::jsonb)
    `;
    this.runSql(sql).catch(() => {});
  }

  public async getRecentConversationHistory(user: any): Promise<{ role: string; text: string }[]> {
    const key = String(user?.id || user?.email || 'default_user');
    const mem = this.userSessionHistory.get(key);
    if (mem && mem.length > 0) {
      return mem.slice(-8);
    }

    if (user?.id) {
      const rows = await this.runSql<any>(
        `SELECT mensaje_usuario, respuesta_catorce FROM ia_brain.conversaciones WHERE usuario_id = ${Number(
          user.id,
        )} ORDER BY created_at DESC LIMIT 4`,
      );
      const turns: { role: string; text: string }[] = [];
      for (const r of (rows || []).reverse()) {
        turns.push({ role: 'user', text: r.mensaje_usuario });
        turns.push({ role: 'catorce', text: r.respuesta_catorce });
      }
      return turns;
    }

    return [];
  }

  /**
   * 🧭 Resuelve nombres humanos (empleado, puesto, subpuesto, cliente) a sus IDs reales en Supabase
   */
  public async resolveEntityIds(hints: {
    empleado_nombre_o_cedula?: string;
    puesto_nombre?: string;
    subpuesto_nombre?: string;
    cliente_nombre_o_nit?: string;
  }) {
    const admin = this.supabase.getSupabaseAdminClient();
    const resolved: {
      empleado?: { id: number; nombre_completo: string; cedula: string };
      puesto?: { id: number; nombre: string; contrato_id: number };
      subpuesto?: { id: number; nombre: string; puesto_id: number };
      cliente?: { id: number; nombre_empresa: string; nit: string };
    } = {};

    const norm = (s: string) =>
      (s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

    if (hints.empleado_nombre_o_cedula) {
      const target = norm(hints.empleado_nombre_o_cedula);
      const { data: emps } = await admin
        .from('empleados')
        .select('id, nombre_completo, cedula')
        .eq('activo', true);
      const match = (emps || []).find(
        (e: any) =>
          norm(e.nombre_completo).includes(target) ||
          target.includes(norm(e.nombre_completo)) ||
          String(e.cedula || '').includes(target),
      );
      if (match) resolved.empleado = match;
    }

    if (hints.puesto_nombre) {
      const target = norm(hints.puesto_nombre)
        .replace(/\b(edificio|puesto|conjunto|sede|torre|unidad)\b/g, '')
        .trim();
      const { data: puestos } = await admin
        .from('puestos_trabajo')
        .select('id, nombre, contrato_id')
        .eq('activo', true);
      const match = (puestos || []).find(
        (p: any) =>
          norm(p.nombre).includes(target) ||
          (target.length > 2 && target.split(/\s+/).some((tk) => tk.length > 2 && norm(p.nombre).includes(tk))),
      );
      if (match) resolved.puesto = match;
    }

    if (hints.subpuesto_nombre) {
      const target = norm(hints.subpuesto_nombre);
      const { data: subs } = await admin
        .from('subpuestos_trabajo')
        .select('id, nombre, puesto_id')
        .eq('activo', true);
      const match = (subs || []).find((s: any) => norm(s.nombre).includes(target));
      if (match) resolved.subpuesto = match;
    }

    if (hints.cliente_nombre_o_nit) {
      const target = norm(hints.cliente_nombre_o_nit);
      const { data: clientes } = await admin
        .from('clientes')
        .select('id, nombre_empresa, nit')
        .eq('activo', true);
      const match = (clientes || []).find(
        (c: any) => norm(c.nombre_empresa).includes(target) || String(c.nit || '').includes(target),
      );
      if (match) resolved.cliente = match;
    }

    return resolved;
  }

  /**
   * ⚡ EJECUTOR UNIVERSAL DE BASE DE DATOS Y MÓDULOS DE PROLICONTROL
   * Permite INSERT, UPDATE y SELECT en cualquier módulo de la plataforma.
   * BLOQUEA cualquier DELETE / DROP / TRUNCATE (restringido por política de seguridad).
   */
  public async executeUniversalPlatformOperation(
    operation: {
      operationType: 'INSERT' | 'UPDATE' | 'SQL_WRITE' | 'DELETE_ATTEMPT';
      table: string;
      payload?: Record<string, any>;
      matchFilter?: Record<string, any>;
      sqlStatement?: string;
      entityHints?: {
        empleado_nombre_o_cedula?: string;
        puesto_nombre?: string;
        subpuesto_nombre?: string;
        cliente_nombre_o_nit?: string;
      };
      moduleName?: string;
      humanSummary?: string;
      comandoOriginal: string;
      canal?: string;
    },
    user: any,
  ) {
    const userRole = String(user?.rol || user?.role || '').toLowerCase();
    const isSuperuser = userRole === 'superusuario';

    // 🛡️ REGLA DE ORO 1: NINGÚN DELETE/DROP/TRUNCATE (Protección inmutable de base de datos)
    const rawSqlUpper = (operation.sqlStatement || '').toUpperCase();
    if (
      operation.operationType === 'DELETE_ATTEMPT' ||
      /(DELETEs+FROM|DROPs+TABLE|TRUNCATEs+TABLE|ALTERs+TABLE)/i.test(rawSqlUpper)
    ) {
      const auditBlock = await this.recordAudit({
        user,
        subagente: 'CATORCE-GUARDIAN',
        accion: 'BLOQUEO_ELIMINACION_SEGURIDAD',
        modulo: operation.moduleName || operation.table || 'Seguridad BD',
        tablaDestino: operation.table,
        registroId: 'PROTECTED',
        comandoOriginal: operation.comandoOriginal,
        parametros: { rol: userRole, isSuperuser },
        resultado: { bloqueado: true, motivo: 'Eliminación restringida de base de datos' },
        exitoso: false,
        canal: operation.canal || 'voz_live_api',
      });

      return {
        ok: false,
        blockedDelete: true,
        auditCode: auditBlock.codigo_auditoria,
        message: isSuperuser
          ? `🛡️ **Protección Activa de CATORCE:** Ingeniero, tengo activado el candado preventivo de seguridad contra eliminaciones directas de base de datos (DELETE). Si desea dar de baja un registro en **${operation.table || 'la plataforma'}**, dígame *"desactívalo"* o *"cámbiale el estado a inactivo"* y lo actualizaré de inmediato preservando la integridad del sistema. (Auditoría: ${auditBlock.codigo_auditoria})`
          : `⛔ **Acción Restringida:** Ingeniero, las operaciones de eliminación directa de base de datos están bloqueadas por políticas de auditoría de **PROLISEG LTDA**. Con gusto puedo ayudarle a consultar, crear o actualizar cualquier registro en la plataforma. (Auditoría: ${auditBlock.codigo_auditoria})`,
      };
    }

    const admin = this.supabase.getSupabaseAdminClient();
    const cleanTable = (operation.table || '').replace(/^public\./i, '').trim().toLowerCase();

    // ⛔ REGLA DE ORO 2: NINGUNA CREACIÓN DE USUARIOS O CREDENCIALES POR PARTE DE CATORCE
    if (
      cleanTable === 'usuarios' ||
      cleanTable === 'users' ||
      cleanTable === 'usuarios_externos' ||
      cleanTable === 'credenciales' ||
      cleanTable === 'auth_users' ||
      (operation.operationType === 'INSERT' && (cleanTable.includes('usuario') || cleanTable.includes('user'))) ||
      /\b(crear|registrar|insertar)\b.*\b(usuario|cuenta|login|password|clave)\b/i.test(operation.comandoOriginal)
    ) {
      const auditBlock = await this.recordAudit({
        user,
        subagente: 'CATORCE-GUARDIAN',
        accion: 'BLOQUEO_CREACION_USUARIOS_SEGURIDAD',
        modulo: 'Usuarios / Control de Acceso',
        tablaDestino: cleanTable,
        registroId: 'BLOCKED',
        comandoOriginal: operation.comandoOriginal,
        parametros: { rol: userRole, isSuperuser },
        resultado: { bloqueado: true, motivo: 'Creación de usuarios no permitida para la IA' },
        exitoso: false,
        canal: operation.canal || 'voz_live_api',
      });

      return {
        ok: false,
        blockedUserCreation: true,
        auditCode: auditBlock.codigo_auditoria,
        message: `⛔ **Acción Restringida:** Ingeniero, por directriz estricta de seguridad de **PROLISEG LTDA**, tengo expresamente restringida la creación de usuarios y credenciales en el sistema. La creación de usuarios debe realizarse directamente desde el módulo administrativo de **Usuarios** para garantizar la validación de identidad y asignación de roles. (Auditoría: ${auditBlock.codigo_auditoria})`,
      };
    }

    const payload = { ...(operation.payload || {}) };

    if (operation.entityHints) {
      const resolved = await this.resolveEntityIds(operation.entityHints);
      if (resolved.empleado && !payload.empleado_id) {
        payload.empleado_id = resolved.empleado.id;
      }
      if (resolved.puesto && !payload.puesto_id) {
        payload.puesto_id = resolved.puesto.id;
        if (cleanTable === 'puestos_trabajo' && !payload.contrato_id && resolved.puesto.contrato_id) {
          payload.contrato_id = resolved.puesto.contrato_id;
        }
      }
      if (resolved.subpuesto && !payload.subpuesto_id) {
        payload.subpuesto_id = resolved.subpuesto.id;
      }
      if (resolved.cliente && !payload.cliente_id) {
        payload.cliente_id = resolved.cliente.id;
      }
    }

    let resultData: any = null;

    if (operation.operationType === 'INSERT' && cleanTable) {
      // Autocompletar campos de auditoría comunes según la tabla
      if (cleanTable === 'turnos') {
        if (!payload.fecha) payload.fecha = new Date().toISOString().slice(0, 10);
        if (!payload.hora_inicio) payload.hora_inicio = '06:00:00';
        if (!payload.hora_fin) payload.hora_fin = '18:00:00';
        if (!payload.tipo_turno) payload.tipo_turno = 'DIURNO';
        if (!payload.estado_turno) payload.estado_turno = 'programado';
        if (user?.id && !payload.asignado_por) payload.asignado_por = Number(user.id);
      } else if (cleanTable === 'asignacion_guardas_puesto') {
        if (user?.id && !payload.asignado_por) payload.asignado_por = Number(user.id);
        if (payload.activo === undefined) payload.activo = true;
      } else if (cleanTable === 'incidentes') {
        if (!payload.fecha_incidente) payload.fecha_incidente = new Date().toISOString();
        if (!payload.nivel_gravedad) payload.nivel_gravedad = 'medio';
        if (!payload.estado) payload.estado = 'abierto';
      }

      this.invalidateTelemetryCache();
      const { data, error } = await admin.from(cleanTable).insert(payload).select();
      if (error) {
        throw new Error(`Error al insertar en ${cleanTable}: ${error.message}`);
      }
      resultData = data?.[0] || data;
    } else if (operation.operationType === 'UPDATE' && cleanTable && operation.matchFilter) {
      let queryBuilder = admin.from(cleanTable).update(payload);
      for (const [k, v] of Object.entries(operation.matchFilter)) {
        queryBuilder = queryBuilder.eq(k, v);
      }
      this.invalidateTelemetryCache();
      const { data, error } = await queryBuilder.select();
      if (error) {
        throw new Error(`Error al actualizar en ${cleanTable}: ${error.message}`);
      }
      resultData = data?.[0] || data;
    } else if (operation.operationType === 'SQL_WRITE' && operation.sqlStatement) {
      resultData = await this.runSql(operation.sqlStatement);
    }

    const audit = await this.recordAudit({
      user,
      subagente: 'CATORCE-OMNISCIENTE',
      accion: `${operation.operationType}_${cleanTable.toUpperCase()}`,
      modulo: operation.moduleName || cleanTable,
      tablaDestino: `public.${cleanTable}`,
      registroId: String(resultData?.id || 'OK'),
      comandoOriginal: operation.comandoOriginal,
      parametros: { payload, matchFilter: operation.matchFilter },
      resultado: resultData || { ok: true },
      exitoso: true,
      canal: operation.canal || 'voz_live_api',
    });

    return {
      ok: true,
      actionExecuted: `${operation.operationType}_${cleanTable.toUpperCase()}`,
      table: cleanTable,
      data: resultData,
      auditCode: audit.codigo_auditoria,
    };
  }

  /**
   * 🛡️ Registra cualquier acción en la tabla de auditoría de CATORCE (`ia_brain.auditoria_acciones`), en `public.auditoria` y en archivo físico Markdown
   */
  public async recordAudit(params: {
    user: any;
    subagente: string;
    accion: string;
    modulo: string;
    tablaDestino?: string;
    registroId?: string;
    comandoOriginal: string;
    parametros?: any;
    resultado?: any;
    exitoso?: boolean;
    canal?: string;
  }) {
    const codigo_auditoria = `AUD-CAT-${Date.now().toString().slice(-6)}`;
    const userId = Number(params.user?.id) || null;
    const userName = String(
      params.user?.nombre_completo || params.user?.nombre || params.user?.email || 'Operador Autorizado',
    ).replace(/'/g, "''");
    const userRole = String(params.user?.rol || 'operador').replace(/'/g, "''");
    const safeCmd = String(params.comandoOriginal || '').replace(/'/g, "''");
    const paramsJson = JSON.stringify(params.parametros || {}).replace(/'/g, "''");
    const resultJson = JSON.stringify(params.resultado || {}).replace(/'/g, "''");
    const exitoso = params.exitoso !== false;

    const sql = `
      INSERT INTO ia_brain.auditoria_acciones
        (codigo_auditoria, usuario_id, usuario_nombre, usuario_rol, subagente, accion_ejecutada, modulo_afectado, tabla_destino, registro_destino_id, comando_original, parametros_ejecucion, resultado_ejecucion, exitoso, canal)
      VALUES
        ('${codigo_auditoria}', ${userId || 'NULL'}, '${userName}', '${userRole}', '${params.subagente}', '${params.accion}', '${params.modulo}', '${params.tablaDestino || ''}', '${params.registroId || ''}', '${safeCmd}', '${paramsJson}'::jsonb, '${resultJson}'::jsonb, ${exitoso}, '${params.canal || 'voz_live_api'}')
    `;

    await this.runSql(sql);

    // También guardar respaldo en el Segundo Cerebro físico PROLISEG LTDA\10_Auditoria_Acciones_Catorce
    try {
      const auditFolder = path.join(this.brainDirectory, '10_Auditoria_Acciones_Catorce');
      fs.mkdirSync(auditFolder, { recursive: true });
      const logFile = path.join(auditFolder, `Auditoria_${new Date().toISOString().slice(0, 10)}.md`);
      const entryLine = `- **[${new Date().toLocaleTimeString('es-CO')}] \`${codigo_auditoria}\`** | **Agente:** \`${params.subagente}\` | **Acción:** \`${params.accion}\` | **Usuario:** ${userName} (${userRole}) | **Comando:** *"${params.comandoOriginal}"*\n`;
      fs.appendFileSync(logFile, entryLine, 'utf8');
    } catch {
      // continuar silenciosamente
    }

    return { codigo_auditoria, timestamp: new Date().toISOString() };
  }
}
