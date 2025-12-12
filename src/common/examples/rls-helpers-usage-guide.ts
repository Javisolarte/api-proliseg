/**
 * 📚 GUÍA DE USO: SERVICIOS HELPER RLS
 * 
 * Esta guía muestra cómo usar los servicios helper para implementar
 * filtros RLS granulares en tus módulos.
 */

import { Injectable } from '@nestjs/common';
import { RlsContext } from '../../config/permissions.config';
import { PuestosHelperService } from '../helpers/puestos-helper.service';
import { EmpleadosHelperService } from '../helpers/empleados-helper.service';
import { RlsValidationService } from '../helpers/rls-validation.service';
import { SupabaseService } from '../../modules/supabase/supabase.service';

// ==================== EJEMPLO 1: FILTRAR TURNOS ====================

@Injectable()
export class TurnosServiceExample {
    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly puestosHelper: PuestosHelperService,
    ) { }

    /**
     * Obtener turnos con filtro RLS según rol
     */
    async findAll(rlsContext?: RlsContext) {
        const supabase = this.supabaseService.getClient();
        let query = supabase.from('turnos').select('*');

        if (rlsContext) {
            // Vigilante: solo sus turnos
            if (rlsContext.rol === 'vigilante') {
                query = query.eq('empleado_id', rlsContext.empleadoId);
            }

            // Cliente: turnos de sus puestos
            else if (rlsContext.rol === 'cliente') {
                const puestoIds = await this.puestosHelper.getPuestoIdsCliente(rlsContext.clienteId);
                if (puestoIds.length > 0) {
                    query = query.in('puesto_id', puestoIds);
                } else {
                    // Cliente sin puestos = sin turnos
                    return { data: [], error: null };
                }
            }

            // Supervisor, Admin, etc: ven todos los turnos (sin filtro)
        }

        return query;
    }
}

// ==================== EJEMPLO 2: FILTRAR PUESTOS ====================

@Injectable()
export class PuestosServiceExample {
    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly puestosHelper: PuestosHelperService,
    ) { }

    /**
     * Obtener puestos con filtro RLS según rol
     */
    async findAll(rlsContext?: RlsContext) {
        const supabase = this.supabaseService.getClient();
        let query = supabase.from('puestos_trabajo').select('*');

        if (rlsContext) {
            // Vigilante: solo puestos asignados
            if (rlsContext.rol === 'vigilante') {
                const puestoIds = await this.puestosHelper.getPuestosAsignadosEmpleado(rlsContext.empleadoId);
                if (puestoIds.length > 0) {
                    query = query.in('id', puestoIds);
                } else {
                    return { data: [], error: null };
                }
            }

            // Cliente: solo sus puestos
            else if (rlsContext.rol === 'cliente') {
                const contratoIds = await this.puestosHelper.getContratoIdsCliente(rlsContext.clienteId);
                if (contratoIds.length > 0) {
                    query = query.in('contrato_id', contratoIds);
                } else {
                    return { data: [], error: null };
                }
            }
        }

        return query;
    }
}

// ==================== EJEMPLO 3: FILTRAR MINUTAS ====================

@Injectable()
export class MinutasServiceExample {
    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly puestosHelper: PuestosHelperService,
        private readonly rlsValidation: RlsValidationService,
    ) { }

    /**
     * Obtener minutas con filtro RLS según rol
     */
    async findAll(rlsContext?: RlsContext) {
        const supabase = this.supabaseService.getClient();
        let query = supabase.from('minutas').select('*');

        if (rlsContext) {
            // Vigilante: minutas de sus puestos O creadas por él
            if (rlsContext.rol === 'vigilante') {
                const puestoIds = await this.puestosHelper.getPuestosAsignadosEmpleado(rlsContext.empleadoId);

                if (puestoIds.length > 0) {
                    // OR: puesto_id IN (...) OR creada_por = userId
                    query = query.or(`puesto_id.in.(${puestoIds.join(',')}),creada_por.eq.${rlsContext.userId}`);
                } else {
                    // Sin puestos, solo las que creó
                    query = query.eq('creada_por', rlsContext.userId);
                }
            }

            // Cliente: minutas de sus puestos
            else if (rlsContext.rol === 'cliente') {
                const puestoIds = await this.puestosHelper.getPuestoIdsCliente(rlsContext.clienteId);
                if (puestoIds.length > 0) {
                    query = query.in('puesto_id', puestoIds);
                } else {
                    return { data: [], error: null };
                }
            }
        }

        return query;
    }

    /**
     * Crear minuta con validación RLS
     */
    async create(dto: any, rlsContext: RlsContext) {
        // Validar que el usuario pueda crear minutas en este puesto
        await this.rlsValidation.validarCreacionMinuta(rlsContext, dto.puesto_id);

        const supabase = this.supabaseService.getClient();
        return supabase.from('minutas').insert({
            ...dto,
            creada_por: rlsContext.userId,
        });
    }
}

// ==================== EJEMPLO 4: VALIDAR ACCESO A EMPLEADO ====================

@Injectable()
export class EmpleadosServiceExample {
    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly empleadosHelper: EmpleadosHelperService,
        private readonly rlsValidation: RlsValidationService,
    ) { }

    /**
     * Obtener un empleado con validación RLS
     */
    async findOne(id: number, rlsContext?: RlsContext) {
        if (rlsContext) {
            // Vigilante solo puede ver su propio perfil
            if (rlsContext.rol === 'vigilante') {
                this.rlsValidation.validarAccesoEmpleadoVigilante(rlsContext.empleadoId, id);
            }

            // Cliente solo puede ver empleados asignados a sus puestos
            else if (rlsContext.rol === 'cliente') {
                await this.rlsValidation.validarAccesoEmpleadoCliente(rlsContext.clienteId, id);
            }
        }

        const supabase = this.supabaseService.getClient();
        return supabase.from('empleados').select('*').eq('id', id).single();
    }

    /**
     * Listar empleados con filtro RLS
     */
    async findAll(rlsContext?: RlsContext) {
        const supabase = this.supabaseService.getClient();
        let query = supabase.from('empleados').select('*');

        if (rlsContext) {
            // Vigilante: solo su propio perfil
            if (rlsContext.rol === 'vigilante') {
                query = query.eq('id', rlsContext.empleadoId);
            }

            // Cliente: solo empleados asignados a sus puestos
            else if (rlsContext.rol === 'cliente') {
                const empleadoIds = await this.empleadosHelper.getEmpleadosAsignadosCliente(rlsContext.clienteId);
                if (empleadoIds.length > 0) {
                    query = query.in('id', empleadoIds);
                } else {
                    return { data: [], error: null };
                }
            }
        }

        return query;
    }
}

// ==================== EJEMPLO 5: USAR FILTROS GENÉRICOS ====================

@Injectable()
export class ReportesServiceExample {
    constructor(
        private readonly rlsValidation: RlsValidationService,
        private readonly supabaseService: SupabaseService,
    ) { }

    /**
     * Generar reporte con filtros automáticos según rol
     */
    async generarReporteTurnos(rlsContext: RlsContext, fechaInicio: string, fechaFin: string) {
        const supabase = this.supabaseService.getClient();

        // Obtener filtro de puestos según rol
        const puestoIds = await this.rlsValidation.getFiltroPuestos(rlsContext);

        let query = supabase
            .from('turnos')
            .select('*, empleados(nombre_completo), puestos_trabajo(nombre)')
            .gte('fecha', fechaInicio)
            .lte('fecha', fechaFin);

        // Aplicar filtro si existe
        if (puestoIds !== null) {
            if (puestoIds.length > 0) {
                query = query.in('puesto_id', puestoIds);
            } else {
                return { data: [], error: null };
            }
        }

        return query;
    }
}

// ==================== MÉTODOS DISPONIBLES ====================

/*
PuestosHelperService:
  - getPuestosAsignadosEmpleado(empleadoId): number[]
  - getSubpuestosAsignadosEmpleado(empleadoId): number[]
  - getContratoIdsCliente(clienteId): number[]
  - getPuestoIdsCliente(clienteId): number[]
  - verificarAsignacionEmpleado(empleadoId, puestoId): boolean
  - verificarAsignacionSubpuesto(empleadoId, subpuestoId): boolean
  - getAsignacionesEmpleado(empleadoId): Asignacion[]
  - verificarPuestoCliente(puestoId, clienteId): boolean

EmpleadosHelperService:
  - getEmpleadosAsignadosCliente(clienteId): number[]
  - getEmpleadosAsignadosPuesto(puestoId): number[]
  - getEmpleadosAsignadosSubpuesto(subpuestoId): number[]
  - verificarEmpleadoCliente(empleadoId, clienteId): boolean
  - getEmpleadosConAsignaciones(empleadoIds?): Empleado[]
  - getTurnosEmpleados(empleadoIds, fechaInicio?, fechaFin?): Turno[]

RlsValidationService:
  - validarAccesoPuestoVigilante(empleadoId, puestoId): void (throws)
  - validarAccesoPuestoCliente(clienteId, puestoId): void (throws)
  - validarAccesoEmpleadoVigilante(empleadoIdSolicitante, empleadoIdObjetivo): void (throws)
  - validarAccesoEmpleadoCliente(clienteId, empleadoId): void (throws)
  - validarCreacionMinuta(rlsContext, puestoId): void (throws)
  - validarEdicionMinuta(rlsContext, minutaId, creadaPor): void (throws)
  - getFiltroPuestos(rlsContext): number[] | null
  - getFiltroEmpleados(rlsContext): number[] | null
*/
