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

  /**
   * Obtener guardas requeridos de un contrato desde la vista
   * Usa la vista vw_guardas_requeridos_contrato que calcula automáticamente
   * los guardas necesarios basados en guardas_activos y estados del ciclo
   */
  async getGuardasRequeridos(contratoId: number, rlsContext?: RlsContext) {
    // Primero verificar que el usuario tiene acceso al contrato
    if (rlsContext) {
      await this.findOne(contratoId, rlsContext);
    }

    const supabase = this.supabaseService.getClient();

    // Consultar la vista de guardas requeridos (puede retornar null si no hay subpuestos)
    const { data: vistaData, error: vistaError } = await supabase
      .from('vw_guardas_requeridos_contrato')
      .select('*')
      .eq('contrato_id', contratoId)
      .maybeSingle(); // Cambiado de .single() a .maybeSingle()

    if (vistaError) {
      this.logger.error(`Error al obtener guardas requeridos: ${vistaError.message}`);
      throw vistaError;
    }

    // Si no hay datos en la vista, retornar valores por defecto
    if (!vistaData) {
      this.logger.warn(`Contrato ${contratoId} no tiene subpuestos configurados`);
      return {
        contrato_id: contratoId,
        total_guardas_activos: 0,
        total_guardas_necesarios: 0,
        total_empleados_asignados: 0,
        cupos_disponibles: 0,
        mensaje: 'El contrato no tiene subpuestos configurados'
      };
    }

    // Obtener empleados asignados al contrato
    const { data: asignaciones, error: asignError } = await supabase
      .from('asignacion_guardas_puesto')
      .select('empleado_id')
      .eq('contrato_id', contratoId)
      .eq('activo', true);

    if (asignError) {
      this.logger.warn(`Error al obtener asignaciones: ${asignError.message}`);
    }

    const empleadosAsignados = asignaciones?.length || 0;
    const cuposDisponibles = (vistaData.total_guardas_necesarios || 0) - empleadosAsignados;

    return {
      ...vistaData,
      total_empleados_asignados: empleadosAsignados,
      cupos_disponibles: cuposDisponibles,
    };
  }

  /**
   * 📊 Obtener resumen de guardas de un contrato
   * Muestra cuántos guardas están asignados vs disponibles
   */
  async getResumenGuardas(contratoId: number) {
    const supabase = this.supabaseService.getClient();

    // Obtener contrato
    const { data: contrato, error: contratoError } = await supabase
      .from('contratos')
      .select('id, guardas_activos, clientes(nombre_empresa)')
      .eq('id', contratoId)
      .single();

    if (contratoError || !contrato) {
      throw new NotFoundException(`Contrato con ID ${contratoId} no encontrado`);
    }

    // Obtener puestos del contrato
    const { data: puestos } = await supabase
      .from('puestos_trabajo')
      .select('id, nombre')
      .eq('contrato_id', contratoId)
      .eq('activo', true);

    // Para cada puesto, obtener sus subpuestos
    const puestosConSubpuestos = await Promise.all(
      (puestos || []).map(async (puesto) => {
        const { data: subpuestos } = await supabase
          .from('subpuestos_trabajo')
          .select('id, nombre, guardas_activos')
          .eq('puesto_id', puesto.id)
          .eq('activo', true);

        // Para cada subpuesto, contar empleados asignados
        const subpuestosConEmpleados = await Promise.all(
          (subpuestos || []).map(async (subpuesto) => {
            const { count } = await supabase
              .from('asignacion_guardas_puesto')
              .select('*', { count: 'exact', head: true })
              .eq('subpuesto_id', subpuesto.id)
              .eq('activo', true);

            return {
              id: subpuesto.id,
              nombre: subpuesto.nombre,
              guardas_activos: subpuesto.guardas_activos,
              empleados_asignados: count || 0,
              cupos_disponibles: subpuesto.guardas_activos - (count || 0)
            };
          })
        );

        const totalGuardasPuesto = subpuestosConEmpleados.reduce(
          (sum, s) => sum + s.guardas_activos, 0
        );
        const totalAsignadosPuesto = subpuestosConEmpleados.reduce(
          (sum, s) => sum + s.empleados_asignados, 0
        );

        return {
          id: puesto.id,
          nombre: puesto.nombre,
          total_guardas: totalGuardasPuesto,
          total_asignados: totalAsignadosPuesto,
          subpuestos: subpuestosConEmpleados
        };
      })
    );

    const guardasAsignadosSubpuestos = puestosConSubpuestos.reduce(
      (sum, p) => sum + p.total_guardas, 0
    );
    const empleadosAsignadosTotal = puestosConSubpuestos.reduce(
      (sum, p) => sum + p.total_asignados, 0
    );


    return {
      contrato_id: contrato.id,
      cliente: (Array.isArray(contrato.clientes)
        ? contrato.clientes[0]?.nombre_empresa
        : (contrato.clientes as any)?.nombre_empresa) || 'Sin cliente',
      guardas_activos_contrato: contrato.guardas_activos,
      guardas_asignados_subpuestos: guardasAsignadosSubpuestos,
      guardas_disponibles_contrato: contrato.guardas_activos - guardasAsignadosSubpuestos,
      empleados_asignados_total: empleadosAsignadosTotal,
      puestos: puestosConSubpuestos
    };
  }
}
