import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { RlsHelperService } from '../../common/services/rls-helper.service';
import { RlsContext } from '../../config/permissions.config';
import type { CreateContratoDto, UpdateContratoDto } from './dto/contrato.dto';

/**
 * 📋 SERVICIO DE CONTRATOS CON SOPORTE RLS
 * 
 * Este servicio implementa filtros RLS para que los clientes
 * solo puedan ver sus propios contratos.
 */
@Injectable()
export class ContratosService {
  private readonly logger = new Logger(ContratosService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly rlsHelper: RlsHelperService,
  ) { }

  /**
   * Listar todos los contratos (con filtros RLS según el rol)
   */
  async findAll(rlsContext?: RlsContext) {
    const supabase = this.supabaseService.getClient();

    let query = supabase
      .from('contratos')
      .select(`
        *,
        clientes(id, nombre_empresa, nit, contacto)
      `)
      .order('created_at', { ascending: false });

    // Aplicar filtros RLS si el usuario es cliente
    if (rlsContext) {
      query = this.rlsHelper.applyRlsFilter(query, 'contratos', rlsContext);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(`Error al listar contratos: ${error.message}`);
      throw error;
    }

    return data;
  }

  /**
   * Obtener un contrato por ID (con validación RLS)
   */
  async findOne(id: number, rlsContext?: RlsContext) {
    const supabase = this.supabaseService.getClient();

    let query = supabase
      .from('contratos')
      .select(`
        *,
        clientes(id, nombre_empresa, nit, direccion, telefono, contacto)
      `)
      .eq('id', id);

    // Aplicar filtros RLS si el usuario es cliente
    if (rlsContext) {
      query = this.rlsHelper.applyRlsFilter(query, 'contratos', rlsContext);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      throw new NotFoundException(`Contrato con ID ${id} no encontrado o sin acceso`);
    }

    return data;
  }

  /**
   * Crear un nuevo contrato
   */
  async create(createContratoDto: CreateContratoDto) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('contratos')
      .insert(createContratoDto)
      .select()
      .single();

    if (error) {
      this.logger.error(`Error al crear contrato: ${error.message}`);
      throw error;
    }

    return data;
  }

  /**
   * Actualizar un contrato (con validación RLS)
   */
  async update(id: number, updateContratoDto: UpdateContratoDto, rlsContext?: RlsContext) {
    // Primero verificar que el usuario tiene acceso al contrato
    if (rlsContext) {
      await this.findOne(id, rlsContext);
    }

    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('contratos')
      .update(updateContratoDto)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException(`Contrato con ID ${id} no encontrado`);
    }

    return data;
  }

  /**
   * Eliminar un contrato (soft delete)
   */
  async remove(id: number, rlsContext?: RlsContext) {
    // Primero verificar que el usuario tiene acceso al contrato
    if (rlsContext) {
      await this.findOne(id, rlsContext);
    }

    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('contratos')
      .update({ estado: false })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException(`Contrato con ID ${id} no encontrado`);
    }

    return { message: 'Contrato eliminado exitosamente', data };
  }

  /**
   * Obtener puestos de un contrato (con validación RLS)
   */
  async getPuestos(contratoId: number, rlsContext?: RlsContext) {
    // Primero verificar que el usuario tiene acceso al contrato
    if (rlsContext) {
      await this.findOne(contratoId, rlsContext);
    }

    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('puestos_trabajo')
      .select('*')
      .eq('contrato_id', contratoId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Error al obtener puestos: ${error.message}`);
      throw error;
    }

    return data;
  }
}
