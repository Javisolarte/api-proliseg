import { SetMetadata } from '@nestjs/common';

/**
 * 🔒 DECORADOR PARA APLICAR FILTROS RLS AUTOMÁTICAMENTE
 * 
 * Uso:
 * @ApplyRLS('horarios')
 * async findAll(user: User) { ... }
 * 
 * Este decorador marca el método para que el interceptor RLS
 * aplique filtros automáticos según el rol del usuario.
 */

export const APPLY_RLS_KEY = 'apply_rls_module';

export const ApplyRLS = (moduleName: string) => SetMetadata(APPLY_RLS_KEY, moduleName);
