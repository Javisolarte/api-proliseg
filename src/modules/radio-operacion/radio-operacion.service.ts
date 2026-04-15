import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type {
  CreateRadioOperadorDto,
  UpdateRadioOperadorDto,
  CreateReporteDto,
  UpdateReporteDto,
  MarcarChequeoDto,
  MarcarChequeosBulkDto,
  CreateReporteDetalleDto,
} from './dto/radio-operacion.dto';

@Injectable()
export class RadioOperacionService {
  private readonly logger = new Logger(RadioOperacionService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  // ============================================================
  // RADIO OPERADORES - CRUD
  // ============================================================

  async findAllOperadores() {
    const supabase = this.supabaseService.getClient();
    this.logger.debug('🔍 Listando todos los radio operadores');

    const sql = `
      SELECT ro.*,
             e.nombre_completo AS empleado_nombre,
             e.cedula AS empleado_cedula,
             e.telefono AS empleado_telefono,
             e.foto_perfil_url AS empleado_foto,
             e.activo AS empleado_activo,
             u.nombre_completo AS creado_por_nombre
      FROM radio_operadores ro
      LEFT JOIN empleados e ON ro.empleado_id = e.id
      LEFT JOIN usuarios_externos u ON ro.creado_por = u.id
      ORDER BY ro.created_at DESC
    `;

    const { data, error } = await supabase.rpc('exec_sql', { query: sql });

    if (error) {
      this.logger.error(`❌ Error listando radio operadores: ${JSON.stringify(error)}`);
      throw error;
    }

    return Array.isArray(data) ? data : [];
  }

  async findOneOperador(id: number) {
    const supabase = this.supabaseService.getClient();
    this.logger.debug(`🔍 Buscando radio operador con ID: ${id}`);

    const sql = `
      SELECT ro.*,
             e.nombre_completo AS empleado_nombre,
             e.cedula AS empleado_cedula,
             e.telefono AS empleado_telefono,
             e.foto_perfil_url AS empleado_foto,
             e.activo AS empleado_activo,
             u.nombre_completo AS creado_por_nombre
      FROM radio_operadores ro
      LEFT JOIN empleados e ON ro.empleado_id = e.id
      LEFT JOIN usuarios_externos u ON ro.creado_por = u.id
      WHERE ro.id = ${id}
      LIMIT 1
    `;

    const { data, error } = await supabase.rpc('exec_sql', { query: sql });

    if (error) {
      this.logger.error(`❌ Error buscando radio operador: ${JSON.stringify(error)}`);
      throw error;
    }

    const rows = Array.isArray(data) ? data : [];
    if (!rows.length) {
      throw new NotFoundException(`Radio operador con ID ${id} no encontrado`);
    }

    return rows[0];
  }

  async createOperador(dto: CreateRadioOperadorDto, userId: number) {
    const supabase = this.supabaseService.getClient();
    this.logger.debug(`🆕 Creando radio operador: ${JSON.stringify(dto)}`);

    const { data, error } = await supabase
      .from('radio_operadores')
      .insert({
        ...dto,
        creado_por: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ConflictException('Este empleado ya está registrado como radio operador');
      }
      this.logger.error(`❌ Error creando radio operador: ${JSON.stringify(error)}`);
      throw error;
    }

    this.logger.debug(`✅ Radio operador creado: ${JSON.stringify(data)}`);
    return data;
  }

  async updateOperador(id: number, dto: UpdateRadioOperadorDto, userId: number) {
    const supabase = this.supabaseService.getClient();
    this.logger.debug(`✏️ Actualizando radio operador ${id}`);

    const { data: existing } = await supabase
      .from('radio_operadores')
      .select('id')
      .eq('id', id)
      .single();

    if (!existing) {
      throw new NotFoundException(`Radio operador con ID ${id} no encontrado`);
    }

    const { data, error } = await supabase
      .from('radio_operadores')
      .update({
        ...dto,
        actualizado_por: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      this.logger.error(`❌ Error actualizando radio operador: ${JSON.stringify(error)}`);
      throw error;
    }

    return data;
  }

  async softDeleteOperador(id: number, userId: number) {
    const supabase = this.supabaseService.getClient();
    this.logger.debug(`🗑️ Soft delete radio operador ${id}`);

    const { data: existing } = await supabase
      .from('radio_operadores')
      .select('id')
      .eq('id', id)
      .single();

    if (!existing) {
      throw new NotFoundException(`Radio operador con ID ${id} no encontrado`);
    }

    const { data, error } = await supabase
      .from('radio_operadores')
      .update({
        activo: false,
        actualizado_por: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      this.logger.error(`❌ Error en soft delete: ${JSON.stringify(error)}`);
      throw error;
    }

    return { message: 'Radio operador desactivado exitosamente', data };
  }

  // ============================================================
  // REPORTES PUESTOS OPERATIVOS
  // ============================================================

  /**
   * Genera las horas de chequeo según turno y frecuencia
   * Turno día: 6:00 - 18:00
   * Turno noche: 18:00 - 06:00 (siguiente día)
   */
  private generarHorasChequeo(turno: string, frecuencia: number): string[] {
    const horas: string[] = [];

    if (turno === 'dia') {
      // 6:00 a 18:00
      for (let h = 6; h < 18; h += frecuencia) {
        horas.push(`${h.toString().padStart(2, '0')}:00`);
      }
    } else {
      // 18:00 a 06:00
      for (let h = 18; h < 24; h += frecuencia) {
        horas.push(`${h.toString().padStart(2, '0')}:00`);
      }
      for (let h = 0; h < 6; h += frecuencia) {
        horas.push(`${h.toString().padStart(2, '0')}:00`);
      }
    }

    return horas;
  }

  async findAllReportes(filters?: { fecha?: string; turno?: string; estado?: string }) {
    const supabase = this.supabaseService.getClient();
    this.logger.debug(`🔍 Listando reportes con filtros: ${JSON.stringify(filters)}`);

    let sql = `
      SELECT rpo.*,
             ro.codigo_radio,
             e.nombre_completo AS radio_operador_nombre,
             e.cedula AS radio_operador_cedula,
             u.nombre_completo AS creado_por_nombre,
             (SELECT COUNT(*) FROM reporte_puestos_detalle rpd WHERE rpd.reporte_id = rpo.id) AS total_puestos,
             (SELECT COUNT(*) FROM reporte_puestos_chequeos rpc 
              JOIN reporte_puestos_detalle rpd2 ON rpc.detalle_id = rpd2.id 
              WHERE rpd2.reporte_id = rpo.id AND rpc.estado = 'sin_novedad') AS total_sin_novedad,
             (SELECT COUNT(*) FROM reporte_puestos_chequeos rpc 
              JOIN reporte_puestos_detalle rpd2 ON rpc.detalle_id = rpd2.id 
              WHERE rpd2.reporte_id = rpo.id) AS total_chequeos
      FROM reportes_puestos_operativos rpo
      LEFT JOIN radio_operadores ro ON rpo.radio_operador_id = ro.id
      LEFT JOIN empleados e ON ro.empleado_id = e.id
      LEFT JOIN usuarios_externos u ON rpo.creado_por = u.id
      WHERE 1=1
    `;

    if (filters?.fecha) sql += ` AND rpo.fecha = '${filters.fecha}'`;
    if (filters?.turno) sql += ` AND rpo.turno = '${filters.turno}'`;
    if (filters?.estado) sql += ` AND rpo.estado = '${filters.estado}'`;

    sql += ` ORDER BY rpo.fecha DESC, rpo.turno DESC`;

    const { data, error } = await supabase.rpc('exec_sql', { query: sql });

    if (error) {
      this.logger.error(`❌ Error listando reportes: ${JSON.stringify(error)}`);
      throw error;
    }

    return Array.isArray(data) ? data : [];
  }

  async findOneReporte(id: number) {
    const supabase = this.supabaseService.getClient();
    this.logger.debug(`🔍 Buscando reporte ${id} con detalle completo`);

    // 1. Obtener encabezado
    const sqlHeader = `
      SELECT rpo.*,
             ro.codigo_radio,
             e.nombre_completo AS radio_operador_nombre,
             e.cedula AS radio_operador_cedula,
             u.nombre_completo AS creado_por_nombre
      FROM reportes_puestos_operativos rpo
      LEFT JOIN radio_operadores ro ON rpo.radio_operador_id = ro.id
      LEFT JOIN empleados e ON ro.empleado_id = e.id
      LEFT JOIN usuarios_externos u ON rpo.creado_por = u.id
      WHERE rpo.id = ${id}
      LIMIT 1
    `;

    const { data: headerData, error: headerError } = await supabase.rpc('exec_sql', { query: sqlHeader });

    if (headerError) {
      this.logger.error(`❌ Error obteniendo encabezado del reporte: ${JSON.stringify(headerError)}`);
      throw headerError;
    }

    const rows = Array.isArray(headerData) ? headerData : [];
    if (!rows.length) {
      throw new NotFoundException(`Reporte con ID ${id} no encontrado`);
    }

    const reporte = rows[0];

    // 2. Obtener detalles (puestos + guardas)
    const sqlDetalle = `
      SELECT rpd.*,
             pt.nombre AS puesto_nombre,
             emp.nombre_completo AS empleado_nombre_completo
      FROM reporte_puestos_detalle rpd
      LEFT JOIN puestos_trabajo pt ON rpd.puesto_id = pt.id
      LEFT JOIN empleados emp ON rpd.empleado_id = emp.id
      WHERE rpd.reporte_id = ${id}
      ORDER BY rpd.orden ASC, rpd.id ASC
    `;

    const { data: detalleData, error: detalleError } = await supabase.rpc('exec_sql', { query: sqlDetalle });

    if (detalleError) {
      this.logger.error(`❌ Error obteniendo detalle: ${JSON.stringify(detalleError)}`);
      throw detalleError;
    }

    const detalles = Array.isArray(detalleData) ? detalleData : [];

    // 3. Obtener chequeos para cada detalle
    if (detalles.length > 0) {
      const detalleIds = detalles.map((d: any) => d.id).filter(id => !!id).join(',');
      
      if (detalleIds) {
        const sqlChequeos = `
          SELECT * FROM reporte_puestos_chequeos
          WHERE detalle_id IN (${detalleIds})
          ORDER BY hora_chequeo ASC
        `;

        const { data: chequeosData, error: chequeosError } = await supabase.rpc('exec_sql', { query: sqlChequeos });

        if (chequeosError) {
          this.logger.error(`❌ Error obteniendo chequeos: ${JSON.stringify(chequeosError)}`);
          throw chequeosError;
        }

        const chequeos = Array.isArray(chequeosData) ? chequeosData : [];

        // Agrupar chequeos por detalle_id
        for (const detalle of detalles) {
          (detalle as any).chequeos = chequeos.filter((c: any) => c.detalle_id === detalle.id);
        }
      } else {
        // Inicializar chequeos vacíos si no hay IDs válidos
        for (const detalle of detalles) {
          (detalle as any).chequeos = [];
        }
      }
    }

    reporte.detalles = detalles;

    // 4. Extraer las horas de chequeo únicas para la plantilla
    const horasChequeo = this.generarHorasChequeo(reporte.turno, reporte.frecuencia_horas);
    reporte.horas_chequeo = horasChequeo;

    return reporte;
  }

  async createReporte(dto: CreateReporteDto, userId: number) {
    const supabase = this.supabaseService.getClient();
    this.logger.debug(`🆕 Creando reporte: ${JSON.stringify(dto)}`);

    // Validar que no exista ya un reporte para esa fecha y turno
    const { data: existing } = await supabase
      .from('reportes_puestos_operativos')
      .select('id')
      .eq('fecha', dto.fecha)
      .eq('turno', dto.turno)
      .maybeSingle();

    if (existing) {
      throw new ConflictException(
        `Ya existe un reporte para la fecha ${dto.fecha} turno ${dto.turno}. ID: ${existing.id}`
      );
    }

    // Calcular hora inicio y fin según turno
    const horaInicio = dto.turno === 'dia' ? '06:00' : '18:00';
    const horaFin = dto.turno === 'dia' ? '18:00' : '06:00';

    // 1. Crear encabezado del reporte
    const { data: reporte, error: reporteError } = await supabase
      .from('reportes_puestos_operativos')
      .insert({
        radio_operador_id: dto.radio_operador_id,
        supervisor_turno: dto.supervisor_turno || null,
        fecha: dto.fecha,
        turno: dto.turno,
        frecuencia_horas: dto.frecuencia_horas,
        estado: 'abierto',
        hora_inicio: horaInicio,
        hora_fin: horaFin,
        observaciones: dto.observaciones || null,
        creado_por: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (reporteError) {
      this.logger.error(`❌ Error creando reporte: ${JSON.stringify(reporteError)}`);
      throw reporteError;
    }

    // 2. Crear detalles (puestos) si se proporcionan
    if (dto.puestos && dto.puestos.length > 0) {
      await this.addPuestosToReporte(reporte.id, dto.puestos, dto.turno, dto.frecuencia_horas);
    }

    this.logger.debug(`✅ Reporte creado con ID: ${reporte.id}`);
    return this.findOneReporte(reporte.id);
  }

  /**
   * Agrega puestos al reporte y genera sus chequeos por hora
   */
  private async addPuestosToReporte(
    reporteId: number,
    puestos: CreateReporteDetalleDto[],
    turno: string,
    frecuencia: number,
  ) {
    const supabase = this.supabaseService.getClient();
    const horasChequeo = this.generarHorasChequeo(turno, frecuencia);

    for (let i = 0; i < puestos.length; i++) {
      const puesto = puestos[i];

      // Insertar detalle del puesto
      const { data: detalle, error: detalleError } = await supabase
        .from('reporte_puestos_detalle')
        .insert({
          reporte_id: reporteId,
          puesto_id: puesto.puesto_id,
          codigo_puesto: puesto.codigo_puesto || null,
          empleado_id: puesto.empleado_id || null,
          nombre_guarda: puesto.nombre_guarda || null,
          cambio_turno: puesto.cambio_turno || false,
          observaciones: puesto.observaciones || null,
          orden: puesto.orden ?? i,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (detalleError) {
        this.logger.error(`❌ Error insertando detalle puesto: ${JSON.stringify(detalleError)}`);
        throw detalleError;
      }

      // Generar chequeos por hora para este puesto
      const chequeosInsert = horasChequeo.map((hora) => ({
        detalle_id: detalle.id,
        hora_chequeo: hora,
        estado: 'pendiente',
        created_at: new Date().toISOString(),
      }));

      const { error: chequeosError } = await supabase
        .from('reporte_puestos_chequeos')
        .insert(chequeosInsert);

      if (chequeosError) {
        this.logger.error(`❌ Error insertando chequeos: ${JSON.stringify(chequeosError)}`);
        throw chequeosError;
      }
    }
  }

  async updateReporte(id: number, dto: UpdateReporteDto, userId: number) {
    const supabase = this.supabaseService.getClient();
    this.logger.debug(`✏️ Actualizando reporte ${id}`);

    const { data: existing } = await supabase
      .from('reportes_puestos_operativos')
      .select('id, estado')
      .eq('id', id)
      .single();

    if (!existing) {
      throw new NotFoundException(`Reporte con ID ${id} no encontrado`);
    }

    if (existing.estado === 'cerrado') {
      throw new BadRequestException('No se puede modificar un reporte cerrado');
    }

    // Actualizar solo campos del encabezado (no puestos)
    const { puestos, ...headerFields } = dto;

    const { data, error } = await supabase
      .from('reportes_puestos_operativos')
      .update({
        ...headerFields,
        actualizado_por: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      this.logger.error(`❌ Error actualizando reporte: ${JSON.stringify(error)}`);
      throw error;
    }

    return data;
  }

  /**
   * Marcar chequeo individual (sin novedad / novedad / no contesta)
   */
  async marcarChequeo(reporteId: number, dto: MarcarChequeoDto, userId: number) {
    const supabase = this.supabaseService.getClient();
    this.logger.debug(`✅ Marcando chequeo ${dto.chequeo_id} como ${dto.estado}`);

    // Verificar que el reporte está abierto
    const { data: reporte } = await supabase
      .from('reportes_puestos_operativos')
      .select('id, estado')
      .eq('id', reporteId)
      .single();

    if (!reporte) {
      throw new NotFoundException(`Reporte con ID ${reporteId} no encontrado`);
    }

    if (reporte.estado === 'cerrado') {
      throw new BadRequestException('No se puede modificar un reporte cerrado');
    }

    const { data, error } = await supabase
      .from('reporte_puestos_chequeos')
      .update({
        estado: dto.estado,
        nota: dto.nota || null,
        chequeado_en: new Date().toISOString(),
        chequeado_por: userId,
      })
      .eq('id', dto.chequeo_id)
      .select()
      .single();

    if (error) {
      this.logger.error(`❌ Error marcando chequeo: ${JSON.stringify(error)}`);
      throw error;
    }

    return data;
  }

  /**
   * Marcar múltiples chequeos a la vez
   */
  async marcarChequeosBulk(reporteId: number, dto: MarcarChequeosBulkDto, userId: number) {
    this.logger.debug(`✅ Marcando ${dto.chequeos.length} chequeos en reporte ${reporteId}`);

    const results: any[] = [];
    for (const chequeo of dto.chequeos) {
      const result = await this.marcarChequeo(reporteId, chequeo, userId);
      results.push(result);
    }

    return { message: `${results.length} chequeos actualizados`, data: results };
  }

  /**
   * Cerrar reporte - No se podrá editar más
   */
  async cerrarReporte(id: number, firma: string, userId: number) {
    const supabase = this.supabaseService.getClient();
    this.logger.debug(`🔒 Cerrando reporte ${id} con firma`);

    const { data: existing } = await supabase
      .from('reportes_puestos_operativos')
      .select('id, estado')
      .eq('id', id)
      .single();

    if (!existing) {
      throw new NotFoundException(`Reporte con ID ${id} no encontrado`);
    }

    if (existing.estado === 'cerrado') {
      throw new BadRequestException('Este reporte ya está cerrado');
    }

    const { data, error } = await supabase
      .from('reportes_puestos_operativos')
      .update({
        estado: 'cerrado',
        firma_operador: firma,
        cerrado_en: new Date().toISOString(),
        actualizado_por: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      this.logger.error(`❌ Error cerrando reporte: ${JSON.stringify(error)}`);
      throw error;
    }

    this.logger.debug(`✅ Reporte ${id} cerrado exitosamente`);
    return { message: 'Reporte cerrado exitosamente', data };
  }

  async reabrirReporte(id: number, userId: number) {
    const supabase = this.supabaseService.getClient();
    this.logger.debug(`🔓 Re-abriendo reporte ${id}`);

    const { data: existing } = await supabase
      .from('reportes_puestos_operativos')
      .select('id')
      .eq('id', id)
      .single();

    if (!existing) {
      throw new NotFoundException(`Reporte con ID ${id} no encontrado`);
    }

    const { data, error } = await supabase
      .from('reportes_puestos_operativos')
      .update({
        estado: 'abierto',
        updated_at: new Date().toISOString(),
        actualizado_por: userId
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      this.logger.error(`❌ Error re-abriendo reporte: ${JSON.stringify(error)}`);
      throw error;
    }

    return { message: 'Reporte re-abierto exitosamente', data };
  }

  async deleteReporte(id: number) {
    const supabase = this.supabaseService.getClient();
    this.logger.debug(`🗑️ Eliminando reporte ${id} permanentemente`);

    // El ON DELETE CASCADE en la base de datos manejará la eliminación 
    // de reporte_puestos_detalle y reporte_puestos_chequeos
    const { error } = await supabase
      .from('reportes_puestos_operativos')
      .delete()
      .eq('id', id);

    if (error) {
      this.logger.error(`❌ Error eliminando reporte: ${JSON.stringify(error)}`);
      throw error;
    }

    return { message: 'Reporte eliminado permanentemente' };
  }

  /**
   * Genera los datos de la plantilla para el formato de reporte
   * (similar al formulario físico de la imagen)
   */
  async generarPlantilla(id: number) {
    const reporte = await this.findOneReporte(id);

    const plantilla = {
      titulo: 'FORMATO REPORTE PUESTOS OPERATIVOS',
      empresa: 'PROLICONTROL',
      codigo: reporte.codigo_formato || 'SIG-GO-F-09',
      fecha_aprobacion: reporte.fecha_aprobacion || '7/04/2026',
      version: '2',
      pagina: reporte.pagina || '1 de 1',
      fecha: reporte.fecha,
      supervisor: reporte.supervisor_turno || '',
      turno: reporte.turno === 'dia' ? 'DÍA' : 'NOCHE',
      horas_dia: reporte.turno === 'dia' ? reporte.horas_chequeo : [],
      horas_noche: reporte.turno === 'noche' ? reporte.horas_chequeo : [],
      frecuencia_horas: reporte.frecuencia_horas,
      estado: reporte.estado,
      radio_operador: reporte.radio_operador_nombre,
      puestos: (reporte.detalles || []).map((d: any) => ({
        codigo_puesto: d.codigo_puesto || d.puesto_id,
        puesto_nombre: d.puesto_nombre,
        guarda_turno: d.nombre_guarda || d.empleado_nombre_completo || 'Sin asignar',
        cambio_turno: d.cambio_turno,
        observaciones: d.observaciones || '',
        chequeos: (d.chequeos || []).map((c: any) => ({
          hora: c.hora_chequeo,
          estado: c.estado,
          nota: c.nota,
        })),
      })),
      observaciones: reporte.observaciones || '',
      firma_operador: reporte.firma_operador || '',
      cerrado_en: reporte.cerrado_en,
    };

    return plantilla;
  }

  /**
   * Agregar un puesto individual a un reporte existente
   */
  async addPuestoToReporte(reporteId: number, dto: CreateReporteDetalleDto, userId: number) {
    const supabase = this.supabaseService.getClient();

    // Verificar reporte existe y está abierto
    const { data: reporte } = await supabase
      .from('reportes_puestos_operativos')
      .select('id, estado, turno, frecuencia_horas')
      .eq('id', reporteId)
      .single();

    if (!reporte) throw new NotFoundException(`Reporte ${reporteId} no encontrado`);
    if (reporte.estado === 'cerrado') throw new BadRequestException('Reporte cerrado');

    await this.addPuestosToReporte(reporteId, [dto], reporte.turno, reporte.frecuencia_horas);

    return { message: 'Puesto agregado exitosamente al reporte' };
  }

  /**
   * Obtener estadísticas para el dashboard
   */
  async getDashboardStats() {
    const supabase = this.supabaseService.getClient();

    const sql = `
      SELECT
        (SELECT COUNT(*) FROM radio_operadores WHERE activo = true) AS total_operadores_activos,
        (SELECT COUNT(*) FROM radio_operadores) AS total_operadores,
        (SELECT COUNT(*) FROM reportes_puestos_operativos WHERE estado = 'abierto') AS reportes_abiertos,
        (SELECT COUNT(*) FROM reportes_puestos_operativos WHERE estado = 'cerrado') AS reportes_cerrados,
        (SELECT COUNT(*) FROM reportes_puestos_operativos) AS total_reportes,
        (SELECT COUNT(*) FROM reportes_puestos_operativos WHERE fecha = CURRENT_DATE) AS reportes_hoy
    `;

    const { data, error } = await supabase.rpc('exec_sql', { query: sql });

    if (error) {
      this.logger.error(`❌ Error obteniendo stats: ${JSON.stringify(error)}`);
      throw error;
    }

    return Array.isArray(data) && data.length > 0 ? data[0] : {};
  }
}
