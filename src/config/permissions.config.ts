/**
 * 🔐 CONFIGURACIÓN CENTRAL DE PERMISOS
 * 
 * Este archivo define la matriz completa de permisos por rol
 * y los filtros RLS (Row Level Security) que se aplican automáticamente.
 * 
 * IMPORTANTE: Los permisos asignados aquí son SUGERENCIAS por defecto.
 * El sistema permite asignar permisos personalizados a cada usuario
 * desde la base de datos (tabla roles_modulos_usuarios_externos).
 */

export type RoleName =
    | 'superusuario'
    | 'gerencia'
    | 'administrativo'
    | 'coordinador'
    | 'supervisor'
    | 'vigilante'
    | 'cliente';

/**
 * 🎯 PERMISOS POR ROL (CONFIGURACIÓN POR DEFECTO)
 * 
 * Estos son los permisos sugeridos para cada rol.
 * Los usuarios pueden tener permisos personalizados asignados en la BD.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<RoleName, string[]> = {
    // ✅ SUPERUSUARIO: Acceso total a los 87 módulos
    superusuario: ['*'], // Wildcard = todos los permisos

    // ✅ GERENCIA: Todo excepto gestión de usuarios/roles/configuración
    gerencia: [
        // Recursos Humanos
        'empleados', 'empleados.read', 'empleados.write', 'empleados.export',
        'capacitaciones', 'capacitaciones.read', 'capacitaciones.write', 'capacitaciones.delete', 'capacitaciones.export',
        'documentos_empleados', 'documentos_empleados.read', 'documentos_empleados.write', 'documentos_empleados.delete', 'documentos_empleados.export',
        'salarios',

        // Operaciones
        'turnos', 'turnos.read', 'turnos.write', 'turnos.read_all',
        'horarios', 'horarios.read', 'horarios.read_all', 'horarios.write',
        'asistencias', 'asistencia.read', 'asistencia.write', 'asistencia.approve',
        'asistencias.read', 'asistencias.write', 'asistencias.update', 'asistencias.export',
        'puestos', 'puestos_trabajo.read', 'puestos_trabajo.write',
        'servicios', 'servicios.read', 'servicios.write', 'servicios.delete',
        'asignaciones',
        'recorridos', 'recorridos.read', 'recorridos.write',
        'turnos_reemplazos',
        'minutas', 'minutas.read', 'minutas.write',
        'rutas',

        // Comercial
        'clientes', 'clientes.read', 'clientes.write', 'clientes.delete', 'clientes.contracts',
        'contratos', 'contratos.read', 'contratos.write', 'contratos.delete', 'contratos.export',

        // Seguridad / Novedades
        'novedades', 'novedades.read', 'novedades.write', 'novedades.delete',
        'incidentes.read', 'incidentes.write',

        // Auditoría / Reportes (solo lectura)
        'auditoria', 'reportes.read', 'reportes.advanced', 'reportes.export',
        'auditoria.logs', 'auditoria.sesiones',
        'Reportes',

        // Configuración (solo lectura)
        'configuracion.read',

        // Notificaciones
        'notificaciones', 'crear-notificacion', 'listar-notificaciones',

        // Móvil
        'app_movil_supervisor',
    ],

    // ✅ ADMINISTRATIVO: Igual que gerencia
    administrativo: [
        // Recursos Humanos
        'empleados', 'empleados.read', 'empleados.write', 'empleados.export',
        'capacitaciones', 'capacitaciones.read', 'capacitaciones.write', 'capacitaciones.delete', 'capacitaciones.export',
        'documentos_empleados', 'documentos_empleados.read', 'documentos_empleados.write', 'documentos_empleados.delete', 'documentos_empleados.export',
        'salarios',

        // Operaciones
        'turnos', 'turnos.read', 'turnos.write', 'turnos.read_all',
        'horarios', 'horarios.read', 'horarios.read_all', 'horarios.write',
        'asistencias', 'asistencia.read', 'asistencia.write', 'asistencia.approve',
        'asistencias.read', 'asistencias.write', 'asistencias.update', 'asistencias.export',
        'puestos', 'puestos_trabajo.read', 'puestos_trabajo.write',
        'servicios', 'servicios.read', 'servicios.write', 'servicios.delete',
        'asignaciones',
        'recorridos', 'recorridos.read', 'recorridos.write',
        'turnos_reemplazos',
        'minutas', 'minutas.read', 'minutas.write',
        'rutas',

        // Comercial
        'clientes', 'clientes.read', 'clientes.write', 'clientes.delete', 'clientes.contracts',
        'contratos', 'contratos.read', 'contratos.write', 'contratos.delete', 'contratos.export',

        // Seguridad / Novedades
        'novedades', 'novedades.read', 'novedades.write', 'novedades.delete',
        'incidentes.read', 'incidentes.write',

        // Auditoría / Reportes (solo lectura)
        'auditoria', 'reportes.read', 'reportes.advanced', 'reportes.export',
        'auditoria.logs', 'auditoria.sesiones',
        'Reportes',

        // Configuración (solo lectura)
        'configuracion.read',

        // Notificaciones
        'notificaciones', 'crear-notificacion', 'listar-notificaciones',

        // Móvil
        'app_movil_supervisor',
    ],

    // ✅ COORDINADOR: Operaciones completas, sin usuarios/roles/CPS
    coordinador: [
        // Recursos Humanos (solo lectura)
        'empleados', 'empleados.read', 'empleados.export',
        'capacitaciones', 'capacitaciones.read', 'capacitaciones.write', 'capacitaciones.export',
        'documentos_empleados', 'documentos_empleados.read', 'documentos_empleados.write', 'documentos_empleados.export',

        // Operaciones (completo)
        'turnos', 'turnos.read', 'turnos.write', 'turnos.read_all',
        'horarios', 'horarios.read', 'horarios.read_all', 'horarios.write',
        'asistencias', 'asistencia.read', 'asistencia.write', 'asistencia.approve',
        'asistencias.read', 'asistencias.write', 'asistencias.update', 'asistencias.export',
        'puestos', 'puestos_trabajo.read', 'puestos_trabajo.write',
        'servicios', 'servicios.read', 'servicios.write', 'servicios.delete',
        'asignaciones',
        'recorridos', 'recorridos.read', 'recorridos.write',
        'turnos_reemplazos',
        'minutas', 'minutas.read', 'minutas.write',
        'rutas',
        'asignar-turnos',

        // Comercial (solo lectura)
        'clientes.read',
        'contratos.read',

        // Seguridad / Novedades
        'novedades', 'novedades.read', 'novedades.write', 'novedades.delete',
        'incidentes.read', 'incidentes.write',

        // Auditoría / Reportes (solo lectura)
        'auditoria', 'reportes.read', 'reportes.export',
        'auditoria.logs',

        // Notificaciones
        'notificaciones', 'crear-notificacion', 'listar-notificaciones',

        // Móvil
        'app_movil_supervisor',
    ],

    // ✅ SUPERVISOR: Solo lectura en operaciones
    supervisor: [
        // Operaciones (solo lectura)
        'turnos', 'turnos.read', 'turnos.read_all',
        'horarios', 'horarios.read', 'horarios.read_all',
        'asistencias', 'asistencia.read', 'asistencias.read',
        'puestos', 'puestos_trabajo.read',
        'servicios', 'servicios.read',
        'asignaciones',
        'recorridos', 'recorridos.read',
        'minutas', 'minutas.read',
        'rutas',

        // Seguridad / Novedades (solo lectura)
        'novedades', 'novedades.read',
        'incidentes.read',

        // Notificaciones
        'listar-notificaciones',

        // Móvil
        'app_movil_supervisor',
    ],

    // ✅ VIGILANTE: Solo datos propios
    vigilante: [
        'horarios', 'horarios.read',
        'asistencias', 'asistencia.read', 'asistencia.write', 'asistencias.read',
        'minutas', 'minutas.read', 'minutas.write',
        'novedades', 'novedades.read', 'novedades.write',
        'rutas',
        'listar-notificaciones',
        'app_movil_vigilante',
    ],

    // ✅ CLIENTE: Solo datos de su contrato
    cliente: [
        'clientes', 'clientes.read', 'clientes.contracts',
        'contratos', 'contratos.read', 'contratos.export',
        'puestos', 'puestos_trabajo.read',
        'minutas', 'minutas.read',
        'novedades', 'novedades.read',
        'rutas',
        'listar-notificaciones',
    ],
};

/**
 * 🔒 FILTROS RLS (ROW LEVEL SECURITY)
 * 
 * Define qué filtros aplicar automáticamente según el rol del usuario.
 * Estos filtros se aplican en los servicios antes de ejecutar queries.
 */
export interface RlsContext {
    userId: number; // ID del usuario en usuarios_externos
    userUUID: string; // UUID de Supabase Auth
    rol: RoleName;
    empleadoId?: number; // ID del empleado asociado (si aplica)
    clienteId?: number; // ID del cliente asociado (si aplica)
}

export type RlsFilterFunction = (ctx: RlsContext) => Record<string, any> | null;

/**
 * Filtros RLS por módulo y rol
 */
export const RLS_FILTERS: Record<string, Partial<Record<RoleName, RlsFilterFunction>>> = {
    // 📅 HORARIOS
    horarios: {
        vigilante: (ctx) => ({ empleado_id: ctx.empleadoId }),
        // Otros roles ven todos los horarios
    },

    // ✅ ASISTENCIAS
    asistencias: {
        vigilante: (ctx) => ({ empleado_id: ctx.empleadoId }),
        // Otros roles ven todas las asistencias
    },

    // 📝 MINUTAS
    minutas: {
        vigilante: (ctx) => {
            // Vigilante solo ve minutas de puestos donde está asignado
            // Esto requiere una query más compleja que se implementa en el servicio
            return null; // Se maneja en el servicio
        },
        cliente: (ctx) => {
            // Cliente solo ve minutas de sus contratos
            return null; // Se maneja en el servicio
        },
    },

    // 🚨 NOVEDADES
    novedades: {
        vigilante: (ctx) => ({ empleado_id: ctx.empleadoId }),
        cliente: (ctx) => {
            // Cliente solo ve novedades de sus contratos
            return null; // Se maneja en el servicio
        },
    },

    // 📋 CONTRATOS
    contratos: {
        cliente: (ctx) => ({ cliente_id: ctx.clienteId }),
    },

    // 🏢 CLIENTES
    clientes: {
        cliente: (ctx) => ({ id: ctx.clienteId }),
    },

    // 🏗️ PUESTOS
    puestos: {
        cliente: (ctx) => {
            // Cliente solo ve puestos de sus contratos
            return null; // Se maneja en el servicio
        },
    },

    // 🛣️ RUTAS
    rutas: {
        vigilante: (ctx) => ({ empleado_id: ctx.empleadoId }),
        cliente: (ctx) => {
            // Cliente solo ve rutas de sus contratos
            return null; // Se maneja en el servicio
        },
    },
};

/**
 * 🔍 HELPER: Verificar si un usuario tiene un permiso específico
 */
export function hasPermission(userPermissions: string[], requiredPermission: string): boolean {
    // Si tiene wildcard (*), tiene todos los permisos
    if (userPermissions.includes('*')) {
        return true;
    }

    // Verificar permiso exacto
    if (userPermissions.includes(requiredPermission)) {
        return true;
    }

    // Verificar permiso padre (ej: si tiene 'empleados', tiene 'empleados.read')
    const [module, action] = requiredPermission.split('.');
    if (action && userPermissions.includes(module)) {
        return true;
    }

    return false;
}

/**
 * 🔍 HELPER: Verificar si un usuario tiene TODOS los permisos requeridos
 */
export function hasAllPermissions(userPermissions: string[], requiredPermissions: string[]): boolean {
    return requiredPermissions.every(perm => hasPermission(userPermissions, perm));
}

/**
 * 🔍 HELPER: Verificar si un usuario tiene AL MENOS UNO de los permisos requeridos
 */
export function hasAnyPermission(userPermissions: string[], requiredPermissions: string[]): boolean {
    return requiredPermissions.some(perm => hasPermission(userPermissions, perm));
}

/**
 * 🔍 HELPER: Obtener filtro RLS para un módulo y rol específico
 */
export function getRlsFilter(module: string, ctx: RlsContext): Record<string, any> | null {
    const filterFn = RLS_FILTERS[module]?.[ctx.rol];
    if (!filterFn) {
        return null; // No hay filtro para este módulo/rol
    }
    return filterFn(ctx);
}

/**
 * 🔍 HELPER: Verificar si un rol requiere filtros RLS
 */
export function requiresRls(rol: RoleName): boolean {
    return rol === 'vigilante' || rol === 'cliente';
}
