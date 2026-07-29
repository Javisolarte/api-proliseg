import { Injectable, NotFoundException, BadRequestException, Logger } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import type { CreateEmpleadoDto, UpdateEmpleadoDto } from "./dto/empleado.dto";

@Injectable()
export class EmpleadosService {
  private readonly logger = new Logger(EmpleadosService.name);

  constructor(private readonly supabaseService: SupabaseService) { }

  // 🔹 Helper para parsear campos JSONB que vienen como strings desde exec_sql / Supabase
  private parseJsonbFields(empleado: any): any {
    if (!empleado) return empleado;

    // Parsear certificados_urls si es string
    if (empleado.certificados_urls && typeof empleado.certificados_urls === 'string') {
      try {
        empleado.certificados_urls = JSON.parse(empleado.certificados_urls);
      } catch (e: any) {
        this.logger.warn(`⚠️ Error parseando certificados_urls: ${e.message}`);
        empleado.certificados_urls = [];
      }
    }

    // Parsear documentos_adicionales_urls si es string
    if (empleado.documentos_adicionales_urls && typeof empleado.documentos_adicionales_urls === 'string') {
      try {
        empleado.documentos_adicionales_urls = JSON.parse(empleado.documentos_adicionales_urls);
      } catch (e: any) {
        this.logger.warn(`⚠️ Error parseando documentos_adicionales_urls: ${e.message}`);
        empleado.documentos_adicionales_urls = [];
      }
    }

    // Parsear documentos_carpetas si es string
    if (empleado.documentos_carpetas && typeof empleado.documentos_carpetas === 'string') {
      try {
        empleado.documentos_carpetas = JSON.parse(empleado.documentos_carpetas);
      } catch (e: any) {
        this.logger.warn(`⚠️ Error parseando documentos_carpetas: ${e.message}`);
        empleado.documentos_carpetas = {};
      }
    }

    return empleado;
  }

  private buildSelectClause(resumen = false): string {
    if (!resumen) {
      return `
        SELECT e.*,
               e.orden,
               eps.nombre AS eps_nombre,
               arl.nombre AS arl_nombre,
               fp.nombre AS fondo_pension_nombre,
               cp.tipo_contrato AS contrato_personal_nombre, 
               u.nombre_completo AS creado_por_nombre,
               tcv.nombre AS tipo_curso_vigilancia_nombre,
               s.nombre AS sede_nombre
        `;
    }

    return `
      SELECT e.id,
             e.usuario_id,
             e.nombre_completo,
             e.cedula,
             e.telefono,
             e.rol,
             e.activo,
             e.foto_perfil_url,
             e.cedula_pdfurl,
             e.hoja_de_vida_url,
             e.eps_id,
             e.arl_id,
             e.fondo_pension_id,
             e.verificado_documentos,
             e.asignado,
             e.tiene_discapacidad,
             e.tiene_curso_vigilancia,
             e.fecha_vencimiento_curso,
             e.fecha_proximas_vacaciones,
             e.dias_vacaciones_disponibles,
             e.fecha_salida,
             e.motivo_salida,
             e.observacion_salida,
             cp.fecha_inicio AS fecha_ingreso,
             (SELECT puesto_id FROM asignacion_guardas_puesto WHERE empleado_id = e.id AND activo = true LIMIT 1) AS puesto_id,
             e.sede_id,
             e.cargo_oficial,
             e.orden,
             e.created_at,
             e.updated_at,
             eps.nombre AS eps_nombre,
             arl.nombre AS arl_nombre,
             fp.nombre AS fondo_pension_nombre,
             cp.tipo_contrato AS contrato_personal_nombre,
             u.nombre_completo AS creado_por_nombre,
             uv.nombre_completo AS actualizado_por_nombre,
             tcv.nombre AS tipo_curso_vigilancia_nombre,
             s.nombre AS sede_nombre
    `;
  }

  private buildFromClause(): string {
    return `
      FROM empleados e
      LEFT JOIN eps ON e.eps_id = eps.id
      LEFT JOIN arl ON e.arl_id = arl.id
      LEFT JOIN fondos_pension fp ON e.fondo_pension_id = fp.id
      LEFT JOIN contratos_personal cp ON e.contrato_personal_id = cp.id
      LEFT JOIN usuarios_externos u ON e.creado_por = u.id
      LEFT JOIN usuarios_externos uv ON e.actualizado_por = uv.id
      LEFT JOIN tipos_curso_vigilancia tcv ON e.tipo_curso_vigilancia_id = tcv.id
      LEFT JOIN sedes s ON e.sede_id = s.id
    `;
  }

  // 🔹 Obtener todos los empleados con joins
  async findAll(filters?: { activo?: boolean; tipoEmpleadoId?: number; resumen?: boolean }) {
    const supabase = this.supabaseService.getClient();
    this.logger.debug(`🟡 Ejecutando findAll con filtros: ${JSON.stringify(filters)}`);

    let sql = `${this.buildSelectClause(!!filters?.resumen)} ${this.buildFromClause()} WHERE 1=1`;

    if (filters?.activo !== undefined) sql += ` AND e.activo = ${filters.activo}`;
    if (filters?.tipoEmpleadoId) sql += ` AND e.tipo_empleado_id = ${filters.tipoEmpleadoId}`;

    sql += ` ORDER BY e.orden ASC, e.created_at DESC`;

    this.logger.debug(`📜 SQL Ejecutado:\n${sql}`);

    const { data, error } = await supabase.rpc("exec_sql", { query: sql });

    if (error) {
      this.logger.error(`❌ Error en Supabase RPC: ${JSON.stringify(error, null, 2)}`);
      throw error;
    }

    const empleados = Array.isArray(data) ? data : [];
    const empleadosParsed = empleados.map(emp => this.parseJsonbFields(emp));

    this.logger.debug(`✅ Resultado Supabase (findAll): ${empleadosParsed.length} registros`);
    return empleadosParsed;
  }

  // 🔹 Obtener un empleado por ID con joins
  async findOne(id: number) {
    const supabase = this.supabaseService.getClient();
    this.logger.debug(`🔍 Buscando empleado con ID: ${id}`);

    const sql = `
      SELECT e.*,
             e.orden,
             eps.nombre AS eps_nombre,
             arl.nombre AS arl_nombre,
             fp.nombre AS fondo_pension_nombre,
             cp.tipo_contrato AS contrato_personal_nombre,
             u.nombre_completo AS creado_por_nombre,
             uv.nombre_completo AS actualizado_por_nombre,
             tcv.nombre AS tipo_curso_vigilancia_nombre,
             s.nombre AS sede_nombre
      FROM empleados e
      LEFT JOIN eps ON e.eps_id = eps.id
      LEFT JOIN arl ON e.arl_id = arl.id
      LEFT JOIN fondos_pension fp ON e.fondo_pension_id = fp.id
      LEFT JOIN contratos_personal cp ON e.contrato_personal_id = cp.id
      LEFT JOIN usuarios_externos u ON e.creado_por = u.id
      LEFT JOIN usuarios_externos uv ON e.actualizado_por = uv.id
      LEFT JOIN tipos_curso_vigilancia tcv ON e.tipo_curso_vigilancia_id = tcv.id
      LEFT JOIN sedes s ON e.sede_id = s.id
      WHERE e.id = ${id}
      LIMIT 1
    `;

    this.logger.debug(`📜 SQL Ejecutado (findOne):\n${sql}`);

    const { data, error } = await supabase.rpc("exec_sql", { query: sql });

    if (error) {
      this.logger.error(`❌ Error en RPC findOne: ${JSON.stringify(error, null, 2)}`);
      throw error;
    }

    const empleados = Array.isArray(data) ? data : [];

    if (!empleados.length) {
      throw new NotFoundException(`Empleado con ID ${id} no encontrado`);
    }

    const empleadoParsed = this.parseJsonbFields(empleados[0]);

    this.logger.debug(`🟢 Empleado encontrado: ${JSON.stringify(empleadoParsed, null, 2)}`);
    return empleadoParsed;
  }

  // 🔹 Helper para sanitizar rutas de almacenamiento (compatibilidad S3/Supabase ASCII)
  private sanitizeStoragePath(path: string): string {
    return path
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ñ/g, 'n')
      .replace(/Ñ/g, 'N')
      .replace(/[^a-zA-Z0-9/._-]/g, '_');
  }

  // 🔹 Helper para subir archivos a Supabase Storage
  private async uploadFile(file: any, targetBucketOrFolder: string, path: string): Promise<string> {
    const supabase = this.supabaseService.getSupabaseAdminClient();
    let bucket = 'empleados';
    let fullPath = path;

    if (targetBucketOrFolder.includes('/')) {
      const parts = targetBucketOrFolder.split('/');
      bucket = parts[0];
      const folder = parts.slice(1).join('/');
      fullPath = `${folder}/${path}`;
    } else if (targetBucketOrFolder !== 'empleados') {
      bucket = 'empleados';
      fullPath = `${targetBucketOrFolder}/${path}`;
    }

    fullPath = this.sanitizeStoragePath(fullPath);

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fullPath, file.buffer, {
        contentType: file.mimetype || 'application/octet-stream',
        upsert: true,
      });

    if (error) {
      this.logger.error(`❌ Error subiendo archivo a ${bucket}/${fullPath}: ${JSON.stringify(error)}`);
      throw error;
    }

    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(fullPath);
    return publicUrlData.publicUrl;
  }

  // 🔹 Crear empleado
  async create(createEmpleadoDto: CreateEmpleadoDto, userId: number, files?: Record<string, any[]>) {
    const supabase = this.supabaseService.getClient();
    this.logger.debug(`🧩 Creando empleado con DTO: ${JSON.stringify(createEmpleadoDto)}`);

    const fileUrls: any = {};

    // Subir archivos si existen
    if (files) {
      if (files.foto_perfil?.[0]) {
        const file = files.foto_perfil[0];
        const ext = file.originalname ? file.originalname.split('.').pop() : 'jpg';
        const path = `${createEmpleadoDto.cedula}.${ext}`;
        fileUrls.foto_perfil_url = await this.uploadFile(file, 'empleados/fotos_perfil', path);
        fileUrls.fecha_ultima_actualizacion_foto = new Date().toISOString();
      }
      if (files.cedula_pdf?.[0]) {
        const file = files.cedula_pdf[0];
        const path = `${createEmpleadoDto.cedula}.pdf`;
        fileUrls.cedula_pdfurl = await this.uploadFile(file, 'empleados/cedulas', path);
      }
      if (files.hoja_de_vida?.[0]) {
        const file = files.hoja_de_vida[0];
        const path = `${createEmpleadoDto.cedula}_hv.pdf`;
        fileUrls.hoja_de_vida_url = await this.uploadFile(file, 'empleados/hojas_vida', path);
      }
      if (files.certificado_bancario?.[0]) {
        const file = files.certificado_bancario[0];
        const ext = file.originalname ? file.originalname.split('.').pop() : 'pdf';
        const path = `${createEmpleadoDto.cedula}_cert_bancario.${ext}`;
        fileUrls.certificado_bancario_url = await this.uploadFile(file, 'certificados_bancarios', path);
      }
      if (files.certificados) {
        const certificadosUrls: string[] = [];
        for (let i = 0; i < files.certificados.length; i++) {
          const file = files.certificados[i];
          const path = `${createEmpleadoDto.cedula}_cert${i + 1}.pdf`;
          const url = await this.uploadFile(file, 'empleados/certificados', path);
          certificadosUrls.push(url);
        }
        fileUrls.certificados_urls = certificadosUrls;
      }
      if (files.documentos_adicionales) {
        const docsUrls: string[] = [];
        for (let i = 0; i < files.documentos_adicionales.length; i++) {
          const file = files.documentos_adicionales[i];
          const path = `${createEmpleadoDto.cedula}_doc${i + 1}.pdf`;
          const url = await this.uploadFile(file, 'empleados/documentos_adicionales', path);
          docsUrls.push(url);
        }
        fileUrls.documentos_adicionales_urls = docsUrls;
      }
    }

    const { data, error } = await supabase
      .from("empleados")
      .insert({
        ...createEmpleadoDto,
        ...fileUrls,
        tipo_vigilante_id: createEmpleadoDto.rol === 'vigilante' ? createEmpleadoDto.tipo_vigilante_id : null,
        creado_por: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`❌ Error al crear empleado: ${JSON.stringify(error, null, 2)}`);
      throw error;
    }

    this.logger.debug(`✅ Empleado creado: ${JSON.stringify(data, null, 2)}`);
    return data;
  }

  // 🔹 Actualizar empleado
  async update(id: number, updateEmpleadoDto: UpdateEmpleadoDto, userId: number, files?: Record<string, any[]>) {
    const supabase = this.supabaseService.getClient();
    this.logger.debug(`🟡 Actualizando empleado ${id} con datos: ${JSON.stringify(updateEmpleadoDto)}`);

    const { data: existingRaw, error: findError } = await supabase
      .from("empleados")
      .select("id, cedula, certificados_urls, documentos_adicionales_urls")
      .eq("id", id)
      .single();

    if (findError || !existingRaw) {
      throw new NotFoundException(`Empleado con ID ${id} no encontrado`);
    }

    const existing = this.parseJsonbFields(existingRaw);
    const fileUrls: any = {};

    // Subir archivos si existen
    if (files) {
      if (files.foto_perfil?.[0]) {
        const file = files.foto_perfil[0];
        const ext = file.originalname ? file.originalname.split('.').pop() : 'jpg';
        const path = `${existing.cedula}.${ext}`;
        fileUrls.foto_perfil_url = await this.uploadFile(file, 'empleados/fotos_perfil', path);
        fileUrls.fecha_ultima_actualizacion_foto = new Date().toISOString();
      }
      if (files.cedula_pdf?.[0]) {
        const file = files.cedula_pdf[0];
        const path = `${existing.cedula}.pdf`;
        fileUrls.cedula_pdfurl = await this.uploadFile(file, 'empleados/cedulas', path);
      }
      if (files.hoja_de_vida?.[0]) {
        const file = files.hoja_de_vida[0];
        const path = `${existing.cedula}_hv.pdf`;
        fileUrls.hoja_de_vida_url = await this.uploadFile(file, 'empleados/hojas_vida', path);
      }
      if (files.certificado_bancario?.[0]) {
        const file = files.certificado_bancario[0];
        const ext = file.originalname ? file.originalname.split('.').pop() : 'pdf';
        const path = `${existing.cedula}_cert_bancario.${ext}`;
        fileUrls.certificado_bancario_url = await this.uploadFile(file, 'certificados_bancarios', path);
      }
      if (files.certificados) {
        const certificadosUrls: string[] = Array.isArray(existing.certificados_urls) ? existing.certificados_urls : [];
        const startIndex = certificadosUrls.length;
        for (let i = 0; i < files.certificados.length; i++) {
          const file = files.certificados[i];
          const path = `${existing.cedula}_cert${startIndex + i + 1}.pdf`;
          const url = await this.uploadFile(file, 'empleados/certificados', path);
          certificadosUrls.push(url);
        }
        fileUrls.certificados_urls = certificadosUrls;
      }
      if (files.documentos_adicionales) {
        const docsUrls: string[] = Array.isArray(existing.documentos_adicionales_urls) ? existing.documentos_adicionales_urls : [];
        const startIndex = docsUrls.length;
        for (let i = 0; i < files.documentos_adicionales.length; i++) {
          const file = files.documentos_adicionales[i];
          const path = `${existing.cedula}_doc${startIndex + i + 1}.pdf`;
          const url = await this.uploadFile(file, 'empleados/documentos_adicionales', path);
          docsUrls.push(url);
        }
        fileUrls.documentos_adicionales_urls = docsUrls;
      }
    }

    const payload: any = {
      ...updateEmpleadoDto,
      ...fileUrls,
      actualizado_por: userId,
      updated_at: new Date().toISOString(),
    };

    if (updateEmpleadoDto.rol !== undefined) {
      payload.tipo_vigilante_id = updateEmpleadoDto.rol === 'vigilante' ? updateEmpleadoDto.tipo_vigilante_id : null;
    }

    const { data, error } = await supabase
      .from("empleados")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      this.logger.error(`❌ Error al actualizar empleado: ${JSON.stringify(error, null, 2)}`);
      throw error;
    }

    this.logger.debug(`✅ Empleado actualizado: ${JSON.stringify(data, null, 2)}`);
    return data;
  }

  // 🔹 Retirar empleado
  async retirarEmpleado(id: number, dto: { fecha_salida: string; motivo_salida: string; observacion_salida?: string }, userId: number) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from("empleados")
      .update({
        activo: false,
        fecha_salida: dto.fecha_salida,
        motivo_salida: dto.motivo_salida,
        observacion_salida: dto.observacion_salida || null,
        actualizado_por: userId,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // 🔹 Eliminar empleado (soft delete)
  async softDelete(id: number, userId: number) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from("empleados")
      .update({
        activo: false,
        actualizado_por: userId,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // 🔹 Capacitaciones
  async getCapacitaciones(id: number) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from("capacitaciones_asistentes")
      .select(`
        capacitacion_id,
        asistio,
        calificacion,
        observaciones,
        capacitaciones (
          id, titulo, descripcion, fecha, duracion_horas, estado
        )
      `)
      .eq("empleado_id", id);

    if (error) throw error;
    return data;
  }

  // 🔹 Salario
  async getSalario(id: number) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from("empleados")
      .select(`
        contratos_personal (
          salarios (
            id, nombre_salario, valor, valor_hora, auxilio_transporte
          )
        )
      `)
      .eq("id", id)
      .single();

    if (error) throw error;
    const cp = Array.isArray(data?.contratos_personal) ? data.contratos_personal[0] : data?.contratos_personal;
    return cp?.salarios;
  }

  // 🔹 Rol
  async getRol(id: number) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from("empleados")
      .select("rol")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  }

  async isVigilante(id: number) {
    const rolData = await this.getRol(id);
    return { es_vigilante: rolData?.rol === "vigilante" };
  }

  async getTipoVigilante(id: number) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from("empleados")
      .select(`
        tipos_vigilante (
          id, nombre, descripcion
        )
      `)
      .eq("id", id)
      .single();

    if (error) throw error;
    return data?.tipos_vigilante;
  }

  async checkAsignado(id: number) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from("empleados")
      .select("asignado")
      .eq("id", id)
      .single();

    if (error) throw error;
    return { asignado: data?.asignado || false };
  }

  // 🔹 Empleados con curso por vencer
  async getCursosPorVencer(dias: number = 30) {
    const supabase = this.supabaseService.getClient();
    this.logger.debug(`🕒 Buscando cursos por vencer en los próximos ${dias} días`);

    const hoy = new Date().toISOString().split('T')[0];
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() + dias);
    const fechaLimiteStr = fechaLimite.toISOString().split('T')[0];

    const sql = `
      SELECT e.id, e.nombre_completo, e.cedula, e.fecha_vencimiento_curso,
             tcv.nombre AS tipo_curso_vigilancia_nombre
      FROM empleados e
      LEFT JOIN tipos_curso_vigilancia tcv ON e.tipo_curso_vigilancia_id = tcv.id
      WHERE e.fecha_vencimiento_curso IS NOT NULL
      AND e.fecha_vencimiento_curso >= '${hoy}'
      AND e.fecha_vencimiento_curso <= '${fechaLimiteStr}'
      AND e.activo = true
      ORDER BY e.fecha_vencimiento_curso ASC
    `;

    const { data, error } = await supabase.rpc("exec_sql", { query: sql });

    if (error) {
      this.logger.error(`❌ Error en getCursosPorVencer: ${JSON.stringify(error, null, 2)}`);
      throw error;
    }

    return Array.isArray(data) ? data : [];
  }

  // 🔹 Actualizar el orden de varios empleados en bloque
  async updateOrder(orders: { id: number; orden: number }[]) {
    const supabase = this.supabaseService.getClient();
    this.logger.debug(`🔢 Actualizando orden de ${orders.length} empleados`);

    const promises = orders.map(item =>
      supabase
        .from("empleados")
        .update({ orden: item.orden, updated_at: new Date().toISOString() })
        .eq("id", item.id)
    );

    const results = await Promise.all(promises);
    const errors = results.filter(r => r.error).map(r => r.error);

    if (errors.length > 0) {
      this.logger.error(`❌ Errores al actualizar ordenes: ${JSON.stringify(errors)}`);
      throw new Error("Error al actualizar el orden de algunos empleados");
    }

    this.logger.debug(`✅ Orden actualizado exitosamente para ${orders.length} empleados`);
    return { message: "Orden actualizado correctamente" };
  }

  // 🔹 Subir un documento específico a las carpetas estructuradas del empleado
  async uploadDocumentoCarpeta(
    empleadoId: number,
    categoria: string,
    subclave: string,
    file: any
  ) {
    if (!file) {
      throw new BadRequestException('El archivo PDF o documento es obligatorio');
    }

    const supabase = this.supabaseService.getClient();
    const admin = this.supabaseService.getSupabaseAdminClient();

    const { data: emp, error: empErr } = await supabase
      .from('empleados')
      .select('id, cedula, nombre_completo, documentos_carpetas')
      .eq('id', empleadoId)
      .single();

    if (empErr || !emp) {
      throw new NotFoundException(`Empleado ID ${empleadoId} no encontrado`);
    }

    const nombreFolder = (emp.nombre_completo || `EMPLEADO_${emp.id}`).trim().toUpperCase();
    const cedula = (emp.cedula || String(emp.id)).trim();
    const ext = file.originalname ? file.originalname.split('.').pop() : 'pdf';

    // Estructura de Storage: EMPLEADOS/[NOMBRE_COMPLETO]/[categoria]/[subclave]-[cedula].pdf
    const storagePath = this.sanitizeStoragePath(`EMPLEADOS/${nombreFolder}/${categoria}/${subclave}-${cedula}.${ext}`);

    this.logger.log(`📂 [CARPETAS] Subiendo documento: ${storagePath}`);

    const { data: upData, error: upErr } = await admin.storage
      .from('empleados')
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype || 'application/pdf',
        upsert: true,
      });

    if (upErr) {
      this.logger.error(`❌ Error al subir documento a bucket empleados: ${upErr.message}`);
      throw upErr;
    }

    const { data: pubData } = admin.storage.from('empleados').getPublicUrl(storagePath);
    const fileUrl = pubData?.publicUrl;

    // Actualizar campo JSONB documentos_carpetas en Supabase DB
    let docsCarpetas: any = emp.documentos_carpetas || {};
    if (typeof docsCarpetas === 'string') {
      try {
        docsCarpetas = JSON.parse(docsCarpetas);
      } catch (e: any) {
        docsCarpetas = {};
      }
    }

    if (categoria === 'hoja-vida' || categoria === 'hoja_vida') {
      docsCarpetas.hoja_vida = [fileUrl];
    } else if (categoria === 'curso-vigilancia') {
      docsCarpetas.curso_vigilancia = [fileUrl];
    } else if (categoria === 'pruebas') {
      if (!docsCarpetas.pruebas) docsCarpetas.pruebas = {};
      docsCarpetas.pruebas[subclave] = fileUrl;
    } else if (categoria === 'afiliaciones') {
      if (!docsCarpetas.afiliaciones) docsCarpetas.afiliaciones = {};
      docsCarpetas.afiliaciones[subclave] = fileUrl;
    } else if (categoria === 'certificados') {
      if (!docsCarpetas.certificados) docsCarpetas.certificados = {};
      docsCarpetas.certificados[subclave] = fileUrl;
    } else if (categoria === 'documentos-empresa') {
      if (!docsCarpetas.documentos_empresa) docsCarpetas.documentos_empresa = {};
      docsCarpetas.documentos_empresa[subclave] = fileUrl;
    } else if (categoria === 'documentos-varios') {
      if (!Array.isArray(docsCarpetas.documentos_varios)) docsCarpetas.documentos_varios = [];
      if (!docsCarpetas.documentos_varios.includes(fileUrl)) {
        docsCarpetas.documentos_varios.push(fileUrl);
      }
    }

    // Actualizar también carpetas genéricas
    if (!docsCarpetas[categoria]) docsCarpetas[categoria] = {};
    if (typeof docsCarpetas[categoria] === 'object' && !Array.isArray(docsCarpetas[categoria])) {
      docsCarpetas[categoria][subclave] = fileUrl;
    }

    const updatePayload: any = {
      documentos_carpetas: docsCarpetas,
      updated_at: new Date().toISOString()
    };

    if (categoria === 'hoja-vida' || categoria === 'hoja_vida') {
      updatePayload.hoja_de_vida_url = fileUrl;
    } else if (subclave === 'certificado-bancario' || subclave === 'bancario') {
      updatePayload.certificado_bancario_url = fileUrl;
    } else if (categoria === 'cedula' || subclave === 'cedula') {
      updatePayload.cedula_pdfurl = fileUrl;
    }

    const { data: updated, error: updateErr } = await supabase
      .from('empleados')
      .update(updatePayload)
      .eq('id', empleadoId)
      .select()
      .single();

    if (updateErr) {
      this.logger.error(`❌ Error al actualizar documentos_carpetas: ${updateErr.message}`);
      throw updateErr;
    }

    this.logger.log(`✅ Documento guardado y actualizado en carpeta ${categoria}/${subclave}`);
    return {
      ok: true,
      file_url: fileUrl,
      documentos_carpetas: updated.documentos_carpetas
    };
  }
}
