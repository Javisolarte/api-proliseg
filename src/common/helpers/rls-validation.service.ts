import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { RlsContext } from '../../config/permissions.config';
import { PuestosHelperService } from './puestos-helper.service';
import { EmpleadosHelperService } from './empleados-helper.service';

/**
 * 🔒 RLS VALIDATION SERVICE
 * 
 * Servicio centralizado para validaciones RLS granulares.
 * Usado en servicios para validar permisos antes de operaciones CRUD.
 */
@Injectable()
export class RlsValidationService {
    private readonly logger = new Logger(RlsValidationService.name);

    constructor(
        private readonly puestosHelper: PuestosHelperService,
        private readonly empleadosHelper: EmpleadosHelperService,
    ) { }

    /**
     * Validar que un vigilante pueda acceder a un puesto
     * Lanza excepción si no tiene permiso
     */
    async validarAccesoPuestoVigilante(empleadoId: number, puestoId: number): Promise<void> {
        const tieneAcceso = await this.puestosHelper.verificarAsignacionEmpleado(empleadoId, puestoId);

        if (!tieneAcceso) {
            throw new ForbiddenException('No tienes permiso para acceder a este puesto');
        }
    }

    /**
     * Validar que un cliente pueda acceder a un puesto
     */
    async validarAccesoPuestoCliente(clienteId: number, puestoId: number): Promise<void> {
        const tieneAcceso = await this.puestosHelper.verificarPuestoCliente(puestoId, clienteId);

        if (!tieneAcceso) {
            throw new ForbiddenException('No tienes permiso para acceder a este puesto');
        }
    }

    /**
     * Validar que un vigilante pueda acceder a un empleado
     * Solo puede ver su propio perfil
     */
    validarAccesoEmpleadoVigilante(empleadoIdSolicitante: number, empleadoIdObjetivo: number): void {
        if (empleadoIdSolicitante !== empleadoIdObjetivo) {
            throw new ForbiddenException('Solo puedes ver tu propio perfil');
        }
    }

    /**
     * Validar que un cliente pueda acceder a un empleado
     */
    async validarAccesoEmpleadoCliente(clienteId: number, empleadoId: number): Promise<void> {
        const tieneAcceso = await this.empleadosHelper.verificarEmpleadoCliente(empleadoId, clienteId);

        if (!tieneAcceso) {
            throw new ForbiddenException('No tienes permiso para ver este empleado');
        }
    }

    /**
     * Validar que un usuario pueda crear una minuta en un puesto
     */
    async validarCreacionMinuta(rlsContext: RlsContext, puestoId: number): Promise<void> {
        // Cliente no puede crear minutas
        if (rlsContext.rol === 'cliente') {
            throw new ForbiddenException('Los clientes no pueden crear minutas');
        }

        // Vigilante solo puede crear en puestos asignados
        if (rlsContext.rol === 'vigilante' && rlsContext.empleadoId) {
            await this.validarAccesoPuestoVigilante(rlsContext.empleadoId, puestoId);
        }

        // Otros roles pueden crear en cualquier puesto
    }

    /**
     * Validar que un usuario pueda editar una minuta
     */
    async validarEdicionMinuta(rlsContext: RlsContext, minutaId: number, creadaPor: number): Promise<void> {
        // Cliente no puede editar minutas
        if (rlsContext.rol === 'cliente') {
            throw new ForbiddenException('Los clientes no pueden editar minutas');
        }

        // Vigilante solo puede editar sus propias minutas
        if (rlsContext.rol === 'vigilante' && creadaPor !== rlsContext.userId) {
            throw new ForbiddenException('Solo puedes editar tus propias minutas');
        }

        // Otros roles pueden editar cualquier minuta
    }

    /**
     * Obtener filtro de puestos según rol
     * Retorna array de IDs de puestos que el usuario puede ver
     */
    async getFiltroPuestos(rlsContext: RlsContext): Promise<number[] | null> {
        switch (rlsContext.rol) {
            case 'vigilante':
                if (!rlsContext.empleadoId) return [];
                return this.puestosHelper.getPuestosAsignadosEmpleado(rlsContext.empleadoId);

            case 'cliente':
                if (!rlsContext.clienteId) return [];
                return this.puestosHelper.getPuestoIdsCliente(rlsContext.clienteId);

            default:
                // Otros roles ven todos los puestos
                return null;
        }
    }

    /**
     * Obtener filtro de empleados según rol
     * Retorna array de IDs de empleados que el usuario puede ver
     */
    async getFiltroEmpleados(rlsContext: RlsContext): Promise<number[] | null> {
        switch (rlsContext.rol) {
            case 'vigilante':
                // Solo puede ver su propio perfil
                if (!rlsContext.empleadoId) return [];
                return [rlsContext.empleadoId];

            case 'cliente':
                // Solo empleados asignados a sus puestos
                if (!rlsContext.clienteId) return [];
                return this.empleadosHelper.getEmpleadosAsignadosCliente(rlsContext.clienteId);

            default:
                // Otros roles ven todos los empleados
                return null;
        }
    }
}
