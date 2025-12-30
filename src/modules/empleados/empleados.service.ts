import { Injectable, NotFoundException, Logger } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import type { CreateEmpleadoDto, UpdateEmpleadoDto } from "./dto/empleado.dto";

@Injectable()
export class EmpleadosService {
  private readonly logger = new Logger(EmpleadosService.name);

  constructor(private readonly supabaseService: SupabaseService) { }

  // 🔹 Helper para parsear campos JSONB que vienen como strings desde exec_sql
  private parseJsonbFields(empleado: any): any {
    if (!empleado) return empleado;

    // Parsear certificados_urls si es string
    if (empleado.certificados_urls && typeof empleado.certificados_urls === 'string') {
      try {
        empleado.certificados_urls = JSON.parse(empleado.certificados_urls);
      } catch (e) {
        this.logger.warn(`⚠️ Error parseando certificados_urls: ${e.message}`);
        empleado.certificados_urls = [];
      }
    }

    // Parsear documentos_adicionales_urls si es string
    if (empleado.documentos_adicionales_urls && typeof empleado.documentos_adicionales_urls === 'string') {
      try {
        empleado.documentos_adicionales_urls = JSON.parse(empleado.documentos_adicionales_urls);
      } catch (e) {
        this.logger.warn(`⚠️ Error parseando documentos_adicionales_urls: ${e.message}`);
        empleado.documentos_adicionales_urls = [];
      }
    }

    return empleado;
  }

  // 🔹 Obtener todos los empleados con joins
  async findAll(filters?: { activo?: boolean; tipoEmpleadoId?: number }) {
    const supabase = this.supabaseService.getClient();
    this.logger.debug(`🟡 Ejecutando findAll con filtros: ${JSON.stringify(filters)}`);

    let sql = `
      SELECT e.*,
             eps.nombre AS eps_nombre,
             arl.nombre AS arl_nombre,
             fp.nombre AS fondo_pension_nombre,
             cp.tipo_contrato AS contrato_personal_nombre, 
             u.nombre_completo AS creado_por_nombre
      FROM empleados e
      LEFT JOIN eps ON e.eps_id = eps.id
      LEFT JOIN arl ON e.arl_id = arl.id
      LEFT JOIN fondos_pension fp ON e.fondo_pension_id = fp.id
      LEFT JOIN contratos_personal cp ON e.contrato_personal_id = cp.id
      LEFT JOIN usuarios_externos u ON e.creado_por = u.id
      WHERE 1=1
    `;

    if (filters?.activo !== undefined) sql += ` AND e.activo = ${filters.activo}`;
    if (filters?.tipoEmpleadoId) sql += ` AND e.tipo_empleado_id = ${filters.tipoEmpleadoId}`;

    sql += ` ORDER BY e.created_at DESC`;

    this.logger.debug(`📜 SQL Ejecutado:\n${sql}`);

    const { data, error } = await supabase.rpc("exec_sql", { query: sql });

    if (error) {
      this.logger.error(`❌ Error en Supabase RPC: ${JSON.stringify(error, null, 2)}`);
      throw error;
    }

    // 🚫 Ya no parseamos JSON (Supabase devuelve un objeto)
    const empleados = Array.isArray(data) ? data : [];

    // Parsear campos JSONB en cada empleado
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
             eps.nombre AS eps_nombre,
             arl.nombre AS arl_nombre,
             fp.nombre AS fondo_pension_nombre,
             cp.tipo_contrato AS contrato_personal_nombre,
             u.nombre_completo AS creado_por_nombre,
             uv.nombre_completo AS actualizado_por_nombre
      FROM empleados e
      LEFT JOIN eps ON e.eps_id = eps.id
      LEFT JOIN arl ON e.arl_id = arl.id
      LEFT JOIN fondos_pension fp ON e.fondo_pension_id = fp.id
      LEFT JOIN contratos_personal cp ON e.contrato_personal_id = cp.id
      LEFT JOIN usuarios_externos u ON e.creado_por = u.id
      LEFT JOIN usuarios_externos uv ON e.actualizado_por = uv.id
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

    // Parsear campos JSONB
    const empleadoParsed = this.parseJsonbFields(empleados[0]);

    this.logger.debug(`🟢 Empleado encontrado: ${JSON.stringify(empleadoParsed, null, 2)}`);
    return empleadoParsed;
  }

  // 🔹 Helper para subir archivos a Supabase Storage
  private async uploadFile(file: any, bucket: string, path: string): Promise<string> {
    const supabase = this.supabaseService.getSupabaseAdminClient();
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (error) {
      this.logger.error(`❌ Error subiendo archivo a ${bucket}: ${JSON.stringify(error)}`);
      throw error;
    }

    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(path);
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
        const ext = file.originalname.split('.').pop();
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
        // Si no es vigilante, forzamos null en tipo_vigilante_id para mantener consistencia
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

    const { data: existing, error: findError } = await supabase
      .from("empleados")
      .select("id, cedula, certificados_urls, documentos_adicionales_urls")
      .eq("id", id)
      .single();

    if (findError || !existing) {
      throw new NotFoundException(`Empleado con ID ${id} no encontrado`);
    }

    const fileUrls: any = {};

    // Subir archivos si existen
    if (files) {
      if (files.foto_perfil?.[0]) {
        const file = files.foto_perfil[0];
        const ext = file.originalname.split('.').pop();
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
      if (files.certificados) {
        const certificadosUrls: string[] = existing.certificados_urls || [];
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
        const docsUrls: string[] = existing.documentos_adicionales_urls || [];
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

    const { data, error } = await supabase
      .from("empleados")
      .update({
        ...updateEmpleadoDto,
        ...fileUrls,
        // Si el rol cambia y ya no es vigilante, se debería limpiar, pero aquí solo tenemos el parcial.
        // Se asume que si el frontend envía rol != vigilante, también debería enviar tipo_vigilante_id: null o lo manejamos aquí si viene el rol.
        ...(updateEmpleadoDto.rol && updateEmpleadoDto.rol !== 'vigilante' ? { tipo_vigilante_id: null } : {}),
        actualizado_por: userId,
        updated_at: new Date().toISOString(),
      })
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

  // 🔹 Soft delete
  async softDelete(id: number, userId: number) {
    const supabase = this.supabaseService.getClient();
    this.logger.debug(`🗑️ Eliminando (soft) empleado con ID: ${id}`);

    const { data: existing, error: findError } = await supabase
      .from("empleados")
      .select("id, activo")
      .eq("id", id)
      .single();

    if (findError || !existing) {
      throw new NotFoundException(`Empleado con ID ${id} no encontrado`);
    }

    const { data, error } = await supabase
      .from("empleados")
      .update({
        activo: false,
        fecha_salida: new Date().toISOString(),
        actualizado_por: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      this.logger.error(`❌ Error en soft delete: ${JSON.stringify(error, null, 2)}`);
      throw error;
    }

    this.logger.debug(`✅ Soft delete completado: ${JSON.stringify(data, null, 2)}`);
    return { message: "Empleado eliminado (soft delete) exitosamente", data };
  }

  // 🔹 Capacitaciones
  async getCapacitaciones(empleadoId: number) {
    const supabase = this.supabaseService.getClient();
    this.logger.debug(`📚 Consultando capacitaciones para empleado ID ${empleadoId}`);

    const { data, error } = await supabase
      .from("empleado_capacitaciones")
      .select(`
        *,
        capacitaciones(id, nombre, descripcion, duracion_horas, obligatoria)
      `)
      .eq("empleado_id", empleadoId)
      .order("fecha_realizacion", { ascending: false });

    if (error) {
      this.logger.error(`❌ Error obteniendo capacitaciones: ${JSON.stringify(error, null, 2)}`);
      throw error;
    }

    this.logger.debug(`📦 Capacitaciones obtenidas: ${data.length}`);
    return data;
  }

  // 🔹 Utilidades Nuevas
  async getSalario(id: number) {
    const supabase = this.supabaseService.getClient();
    // Buscar salario a través del contrato personal activo
    const { data, error } = await supabase
      .from('contratos_personal')
      .select(`
        salarios (
          id, nombre_salario, valor
        )
      `)
      .eq('empleado_id', id)
      .eq('estado', 'activo')
      .single();

    if (error) {
      // Si no tiene contrato activo, retornamos null o error
      this.logger.warn(`No se encontró salario/contrato activo para empleado ${id}: ${error.message}`);
      return null;
    }
    return data?.salarios;
  }

  async getRol(id: number) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('empleados')
      .select('rol')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async isVigilante(id: number) {
    const rolData = await this.getRol(id);
    return { es_vigilante: rolData?.rol === 'vigilante' };
  }

  async getTipoVigilante(id: number) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('empleados')
      .select(`
        tipos_vigilante (
          id, nombre, descripcion
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data?.tipos_vigilante;
  }

  async checkAsignado(id: number) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('empleados')
      .select('asignado')
      .eq('id', id)
      .single();

    if (error) throw error;
    return { asignado: data?.asignado || false };
  }
}
