import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { APPLY_RLS_KEY } from '../decorators/apply-rls.decorator';
import { getRlsFilter, RlsContext } from '../../config/permissions.config';

/**
 * 🔒 INTERCEPTOR DE FILTROS RLS
 * 
 * Este interceptor se ejecuta antes de los métodos marcados con @ApplyRLS
 * y agrega el contexto RLS a la request para que los servicios puedan usarlo.
 */
@Injectable()
export class RlsFilterInterceptor implements NestInterceptor {
    private readonly logger = new Logger(RlsFilterInterceptor.name);

    constructor(private reflector: Reflector) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const moduleName = this.reflector.get<string>(APPLY_RLS_KEY, context.getHandler());

        if (!moduleName) {
            // No hay decorador @ApplyRLS, continuar sin filtros
            return next.handle();
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user) {
            this.logger.warn('⚠️ [RlsFilterInterceptor] No hay usuario en la request');
            return next.handle();
        }

        // Construir contexto RLS
        const rlsContext: RlsContext = {
            userId: user.id,
            userUUID: user.user_id,
            rol: user.rol,
            empleadoId: user.empleado_id,
            clienteId: user.cliente_id,
        };

        // Obtener filtro RLS para este módulo y rol
        const rlsFilter = getRlsFilter(moduleName, rlsContext);

        if (rlsFilter) {
            this.logger.log(
                `🔒 [RlsFilterInterceptor] Aplicando filtro RLS para módulo "${moduleName}" y rol "${user.rol}":`,
                rlsFilter
            );
            // Agregar filtro a la request para que el servicio lo use
            request.rlsFilter = rlsFilter;
            request.rlsContext = rlsContext;
        } else {
            this.logger.log(
                `✅ [RlsFilterInterceptor] No hay filtro RLS para módulo "${moduleName}" y rol "${user.rol}"`
            );
        }

        return next.handle();
    }
}
