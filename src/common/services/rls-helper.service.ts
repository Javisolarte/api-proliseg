import { Injectable, Logger } from '@nestjs/common';
import { RlsContext, getRlsFilter, requiresRls } from '../../config/permissions.config';

/**
 * 🔒 SERVICIO HELPER PARA APLICAR FILTROS RLS
 * 
 * Este servicio proporciona métodos para aplicar filtros RLS
 * a queries de Supabase de forma consistente.
 */
@Injectable()
export class RlsHelperService {
    private readonly logger = new Logger(RlsHelperService.name);

    /**
     * Aplica filtros RLS a una query de Supabase
     * 
     * @param query - Query de Supabase
     * @param moduleName - Nombre del módulo (ej: 'horarios', 'asistencias')
     * @param ctx - Contexto RLS del usuario
     * @returns Query con filtros aplicados
     */
    applyRlsFilter(query: any, moduleName: string, ctx: RlsContext): any {
        if (!requiresRls(ctx.rol)) {
            // Este rol no requiere filtros RLS
            this.logger.log(`✅ Rol "${ctx.rol}" no requiere filtros RLS para módulo "${moduleName}"`);
            return query;
        }

        const filter = getRlsFilter(moduleName, ctx);

        if (!filter) {
            this.logger.log(`✅ No hay filtro RLS para módulo "${moduleName}" y rol "${ctx.rol}"`);
            return query;
        }

        this.logger.log(`🔒 Aplicando filtro RLS para módulo "${moduleName}":`, filter);

        // Aplicar cada condición del filtro
        Object.entries(filter).forEach(([key, value]) => {
            query = query.eq(key, value);
        });

        return query;
    }

    /**
     * Crea un contexto RLS desde un objeto usuario
     */
    createRlsContext(user: any): RlsContext {
        return {
            userId: user.id,
            userUUID: user.user_id,
            rol: user.rol,
            empleadoId: user.empleado_id,
            clienteId: user.cliente_id,
        };
    }

    /**
     * Verifica si un usuario puede acceder a un registro específico
     * basándose en filtros RLS
     */
    canAccessRecord(record: any, moduleName: string, ctx: RlsContext): boolean {
        if (!requiresRls(ctx.rol)) {
            return true; // Sin restricciones RLS
        }

        const filter = getRlsFilter(moduleName, ctx);

        if (!filter) {
            return true; // No hay filtro definido
        }

        // Verificar que el registro cumple con todos los filtros
        return Object.entries(filter).every(([key, value]) => {
            return record[key] === value;
        });
    }
}
