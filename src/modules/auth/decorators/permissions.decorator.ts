// auth/decorators/permissions.decorator.ts
import { SetMetadata } from "@nestjs/common";

export const PERMISSIONS_KEY = "required_permissions";

/**
 * Use: @RequirePermissions("empleados") o @RequirePermissions("empleados","capacitaciones")
 * Por convención este decorador requiere **todos** los permisos listados.
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
