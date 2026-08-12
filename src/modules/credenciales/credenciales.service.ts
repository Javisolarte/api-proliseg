import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateCredencialDto, UpdateCredencialDto } from './dto/credenciales.dto';
import * as crypto from 'crypto';

@Injectable()
export class CredencialesService {
  private readonly logger = new Logger(CredencialesService.name);
  private readonly ALGORITHM = 'aes-256-cbc';
  private readonly ENCRYPTION_KEY: Buffer;

  constructor(private readonly supabaseService: SupabaseService) {
    // Derive a 32-byte key from VAULT_ENCRYPTION_KEY env var (or use a default for dev)
    const rawKey = process.env.VAULT_ENCRYPTION_KEY || 'ProlisegVaultKey2026SecureDefault';
    this.ENCRYPTION_KEY = crypto.scryptSync(rawKey, 'proliseg-vault-salt', 32);
  }

  // ========== CIFRADO / DESCIFRADO AES-256-CBC ==========

  private encrypt(text: string): string {
    if (!text || text.trim() === '') return '';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.ALGORITHM, this.ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  private decrypt(encryptedText: string): string {
    if (!encryptedText || encryptedText.trim() === '' || !encryptedText.includes(':')) return '';
    try {
      const [ivHex, encrypted] = encryptedText.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv(this.ALGORITHM, this.ENCRYPTION_KEY, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (e) {
      this.logger.error('Error descifrando:', e);
      return '[ERROR AL DESCIFRAR]';
    }
  }

  // Helper para SQL via RPC
  private async execSql(query: string) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase.rpc('exec_sql', { query });
    if (error) {
      this.logger.error(`Error en execSql: ${error.message} | SQL: ${query.substring(0, 200)}`);
      throw new BadRequestException(`Error de base de datos: ${error.message}`);
    }
    return Array.isArray(data) ? data : [];
  }

  // ========== LISTAR TODAS LAS CREDENCIALES CON FILTROS ==========
  async findAll(filters?: { tipo_dispositivo?: string; estado?: string; asignado?: string }) {
    try {
      const supabase = this.supabaseService.getSupabaseAdminClient();
      let query = supabase
        .from('dispositivos_credenciales')
        .select('id, nombre_dispositivo, tipo_dispositivo, marca, modelo, numero_serie, direccion_ip, puerto, url_acceso, asignado, puesto_asignado, puesto_id, cuenta_usuario, cuenta_correo, notas, estado, creado_por, creado_por_nombre, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (filters?.tipo_dispositivo) {
        query = query.eq('tipo_dispositivo', filters.tipo_dispositivo);
      }
      if (filters?.estado) {
        query = query.eq('estado', filters.estado);
      }
      if (filters?.asignado !== undefined && filters?.asignado !== null) {
        query = query.eq('asignado', filters.asignado === 'true');
      }

      const { data, error } = await query;

      if (error) {
        this.logger.error('Error listando credenciales:', error);
        throw new BadRequestException(`Error listando credenciales: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      this.logger.error('Error en findAll credenciales:', error);
      throw error;
    }
  }

  // ========== OBTENER DETALLE (SIN CONTRASEÑA DESCIFRADA) ==========
  async findOne(id: number) {
    try {
      const supabase = this.supabaseService.getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('dispositivos_credenciales')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        throw new NotFoundException(`Credencial con ID ${id} no encontrada`);
      }

      // Enmascarar campos sensibles
      return {
        ...data,
        contrasena_cifrada: data.contrasena_cifrada ? '••••••••' : null,
        patron_acceso: data.patron_acceso ? '••••••••' : null,
        pin_acceso: data.pin_acceso ? '••••••••' : null,
        tiene_contrasena: !!data.contrasena_cifrada,
        tiene_patron: !!data.patron_acceso,
        tiene_pin: !!data.pin_acceso
      };
    } catch (error) {
      this.logger.error(`Error al buscar credencial ${id}:`, error);
      throw error;
    }
  }

  // ========== REVELAR CONTRASEÑA / PATRÓN / PIN (DESCIFRAR) ==========
  async reveal(id: number) {
    try {
      const supabase = this.supabaseService.getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('dispositivos_credenciales')
        .select('id, contrasena_cifrada, patron_acceso, pin_acceso')
        .eq('id', id)
        .single();

      if (error || !data) {
        throw new NotFoundException(`Credencial con ID ${id} no encontrada`);
      }

      return {
        id: data.id,
        contrasena: data.contrasena_cifrada ? this.decrypt(data.contrasena_cifrada) : null,
        patron_acceso: data.patron_acceso ? this.decrypt(data.patron_acceso) : null,
        pin_acceso: data.pin_acceso ? this.decrypt(data.pin_acceso) : null
      };
    } catch (error) {
      this.logger.error(`Error revelando credencial ${id}:`, error);
      throw error;
    }
  }

  // ========== CREAR NUEVA CREDENCIAL ==========
  async create(createDto: CreateCredencialDto, usuarioId?: number) {
    try {
      const supabase = this.supabaseService.getSupabaseAdminClient();

      let creadoPorNombre = 'Administrador SGG';
      if (usuarioId) {
        try {
          const { data: userObj } = await supabase
            .from('usuarios_externos')
            .select('nombre_completo')
            .eq('id', usuarioId)
            .single();
          if (userObj && userObj.nombre_completo) {
            creadoPorNombre = userObj.nombre_completo;
          }
        } catch (e) {
          this.logger.error('Error fetching creator name:', e);
        }
      }

      const payload: any = {
        nombre_dispositivo: createDto.nombre_dispositivo,
        tipo_dispositivo: createDto.tipo_dispositivo || 'otro',
        marca: createDto.marca || null,
        modelo: createDto.modelo || null,
        numero_serie: createDto.numero_serie || null,
        direccion_ip: createDto.direccion_ip || null,
        puerto: createDto.puerto || null,
        url_acceso: createDto.url_acceso || null,
        asignado: createDto.asignado === true,
        puesto_asignado: createDto.puesto_asignado || null,
        puesto_id: createDto.puesto_id || null,
        cuenta_usuario: createDto.cuenta_usuario || null,
        cuenta_correo: createDto.cuenta_correo || null,
        contrasena_cifrada: createDto.contrasena ? this.encrypt(createDto.contrasena) : null,
        patron_acceso: createDto.patron_acceso ? this.encrypt(createDto.patron_acceso) : null,
        pin_acceso: createDto.pin_acceso ? this.encrypt(createDto.pin_acceso) : null,
        notas: createDto.notas || null,
        estado: createDto.estado || 'activo',
        creado_por: usuarioId || null,
        creado_por_nombre: creadoPorNombre
      };

      const { data, error } = await supabase
        .from('dispositivos_credenciales')
        .insert(payload)
        .select()
        .single();

      if (error) {
        this.logger.error('Error insertando credencial:', error);
        throw new BadRequestException(`Error de base de datos: ${error.message}`);
      }

      // Registrar auditoría de creación
      try {
        await supabase.from('dispositivos_credenciales_historial').insert({
          credencial_id: data.id,
          tipo_accion: 'creacion',
          usuario_id: usuarioId || null,
          usuario_nombre: creadoPorNombre,
          contrasena_nueva_cifrada: payload.contrasena_cifrada,
          patron_nuevo_acceso: payload.patron_acceso,
          cuenta_usuario_nueva: payload.cuenta_usuario,
          cuenta_correo_nueva: payload.cuenta_correo,
          cambios_resumen: 'Creación inicial de la credencial en el sistema'
        });
      } catch (eHist) {
        this.logger.error('Error registrando historial inicial:', eHist);
      }

      return this.findOne(data.id);
    } catch (error) {
      this.logger.error('Error creando credencial:', error);
      throw error;
    }
  }

  // ========== ACTUALIZAR CREDENCIAL CON HISTORIAL AUDITOR ==========
  async update(id: number, updateDto: UpdateCredencialDto, usuarioId?: number) {
    try {
      const supabase = this.supabaseService.getSupabaseAdminClient();

      // Obtener registro existente completo
      const { data: existente, error: errExist } = await supabase
        .from('dispositivos_credenciales')
        .select('*')
        .eq('id', id)
        .single();

      if (errExist || !existente) {
        throw new NotFoundException('Credencial no encontrada');
      }

      let editorNombre = 'Administrador SGG';
      if (usuarioId) {
        try {
          const { data: userObj } = await supabase
            .from('usuarios_externos')
            .select('nombre_completo')
            .eq('id', usuarioId)
            .single();
          if (userObj && userObj.nombre_completo) {
            editorNombre = userObj.nombre_completo;
          }
        } catch (e) {
          this.logger.error('Error fetching editor name:', e);
        }
      }

      const payload: any = {
        nombre_dispositivo: updateDto.nombre_dispositivo,
        tipo_dispositivo: updateDto.tipo_dispositivo,
        marca: updateDto.marca || null,
        modelo: updateDto.modelo || null,
        numero_serie: updateDto.numero_serie || null,
        direccion_ip: updateDto.direccion_ip || null,
        puerto: updateDto.puerto || null,
        url_acceso: updateDto.url_acceso || null,
        asignado: updateDto.asignado === true,
        puesto_asignado: updateDto.puesto_asignado || null,
        puesto_id: updateDto.puesto_id || null,
        cuenta_usuario: updateDto.cuenta_usuario || null,
        cuenta_correo: updateDto.cuenta_correo || null,
        notas: updateDto.notas || null,
        estado: updateDto.estado || 'activo',
        updated_at: new Date().toISOString()
      };

      const cambiosList: string[] = [];

      if (updateDto.cuenta_usuario !== existente.cuenta_usuario) {
        cambiosList.push('Usuario de acceso');
      }
      if (updateDto.cuenta_correo !== existente.cuenta_correo) {
        cambiosList.push('Correo de recuperación');
      }

      // Solo actualizar campos cifrados si vienen con valor nuevo (no enmascarado)
      if (updateDto.contrasena && updateDto.contrasena !== '••••••••') {
        payload.contrasena_cifrada = this.encrypt(updateDto.contrasena);
        cambiosList.push('Contraseña de acceso');
      }
      if (updateDto.patron_acceso && updateDto.patron_acceso !== '••••••••') {
        payload.patron_acceso = this.encrypt(updateDto.patron_acceso);
        cambiosList.push('Patrón de desbloqueo');
      }
      if (updateDto.pin_acceso && updateDto.pin_acceso !== '••••••••') {
        payload.pin_acceso = this.encrypt(updateDto.pin_acceso);
        cambiosList.push('PIN de acceso');
      }
      if (updateDto.nombre_dispositivo !== existente.nombre_dispositivo) {
        cambiosList.push('Nombre del servicio/dispositivo');
      }
      if (updateDto.estado !== existente.estado) {
        cambiosList.push('Estado de activación');
      }

      const { error } = await supabase
        .from('dispositivos_credenciales')
        .update(payload)
        .eq('id', id);

      if (error) {
        this.logger.error(`Error actualizando credencial ${id}:`, error);
        throw new BadRequestException(`Error actualizando credencial: ${error.message}`);
      }

      // Registrar en el historial de cambios
      try {
        const resumenText = cambiosList.length > 0
          ? `Modificaciones realizadas: ${cambiosList.join(', ')}`
          : 'Actualización general de datos';

        await supabase.from('dispositivos_credenciales_historial').insert({
          credencial_id: id,
          tipo_accion: 'modificacion',
          usuario_id: usuarioId || null,
          usuario_nombre: editorNombre,
          contrasena_anterior_cifrada: existente.contrasena_cifrada,
          contrasena_nueva_cifrada: payload.contrasena_cifrada || existente.contrasena_cifrada,
          patron_anterior_acceso: existente.patron_acceso,
          patron_nuevo_acceso: payload.patron_acceso || existente.patron_acceso,
          cuenta_usuario_anterior: existente.cuenta_usuario,
          cuenta_usuario_nueva: payload.cuenta_usuario,
          cuenta_correo_anterior: existente.cuenta_correo,
          cuenta_correo_nueva: payload.cuenta_correo,
          cambios_resumen: resumenText,
          motivo_cambio: updateDto.motivo_cambio || null
        });
      } catch (eHist) {
        this.logger.error('Error insertando registro en el historial auditor:', eHist);
      }

      return this.findOne(id);
    } catch (error) {
      this.logger.error(`Error actualizando credencial ${id}:`, error);
      throw error;
    }
  }

  // ========== OBTENER HISTORIAL DE CAMBIOS Y VERSIONES ANTERIORES ==========
  async getHistorial(id: number) {
    try {
      const supabase = this.supabaseService.getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('dispositivos_credenciales_historial')
        .select('*')
        .eq('credencial_id', id)
        .order('created_at', { ascending: false });

      if (error) {
        this.logger.error(`Error consultando historial de credencial ${id}:`, error);
        throw new BadRequestException(`Error consultando historial: ${error.message}`);
      }

      // Descifrar versiones anteriores para la auditoría autorizada
      const historialFormateado = (data || []).map(h => ({
        ...h,
        contrasena_anterior: h.contrasena_anterior_cifrada ? this.decrypt(h.contrasena_anterior_cifrada) : null,
        contrasena_nueva: h.contrasena_nueva_cifrada ? this.decrypt(h.contrasena_nueva_cifrada) : null,
        patron_anterior: h.patron_anterior_acceso ? this.decrypt(h.patron_anterior_acceso) : null,
        patron_nuevo: h.patron_nuevo_acceso ? this.decrypt(h.patron_nuevo_acceso) : null
      }));

      return historialFormateado;
    } catch (error) {
      this.logger.error(`Error en getHistorial ${id}:`, error);
      throw error;
    }
  }

  // ========== ELIMINAR CREDENCIAL ==========
  async remove(id: number) {
    try {
      const supabase = this.supabaseService.getSupabaseAdminClient();
      const { error } = await supabase.from('dispositivos_credenciales').delete().eq('id', id);
      if (error) {
        this.logger.error(`Error eliminando credencial ${id}:`, error);
        throw new BadRequestException(`Error eliminando credencial: ${error.message}`);
      }
      return { success: true, message: `Credencial ${id} eliminada correctamente` };
    } catch (error) {
      this.logger.error(`Error al eliminar credencial ${id}:`, error);
      throw error;
    }
  }

  // ========== ESTADÍSTICAS ==========
  async getStats() {
    try {
      const sql = `
        SELECT
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE estado = 'activo')::int as activos,
          COUNT(*) FILTER (WHERE estado = 'inactivo')::int as inactivos,
          COUNT(*) FILTER (WHERE asignado = true)::int as con_puesto,
          COUNT(*) FILTER (WHERE asignado = false)::int as sin_puesto
        FROM dispositivos_credenciales
      `;
      const rows = await this.execSql(sql);
      const stats = rows[0] || { total: 0, activos: 0, inactivos: 0, con_puesto: 0, sin_puesto: 0 };

      // Conteo por tipo
      const sqlTipos = `
        SELECT tipo_dispositivo, COUNT(*)::int as cantidad
        FROM dispositivos_credenciales
        GROUP BY tipo_dispositivo
        ORDER BY cantidad DESC
      `;
      const tipos = await this.execSql(sqlTipos);

      return { ...stats, por_tipo: tipos };
    } catch (error) {
      this.logger.error('Error obteniendo estadísticas de credenciales:', error);
      throw error;
    }
  }
}
