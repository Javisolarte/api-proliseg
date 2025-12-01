// permissions.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import { hasPermission } from "../../../config/permissions.config";

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(private reflector: Reflector) { }

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions =
      this.reflector.get<string[]>(PERMISSIONS_KEY, context.getHandler()) || [];

    this.logger.log(`🧩 Permisos requeridos: ${requiredPermissions.join(", ")}`);

    // Si no hay permisos requeridos, dejar pasar
    if (!requiredPermissions || requiredPermissions.length === 0) {
      this.logger.log("✅ No se requieren permisos para esta ruta.");
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      this.logger.error("⛔ No hay usuario autenticado en la request.");
      throw new ForbiddenException("Usuario no autenticado o no presente en la petición.");
    }

    // Intentar obtener permisos desde varias posibles ubicaciones
    let userPermissionsRaw = user.permissions ?? user.permisos ?? null;

    if (!userPermissionsRaw) {
      this.logger.warn("⚠️ Intentando obtener permisos desde metadatos...");
      const appMeta = user.app_metadata ?? user.user_metadata ?? null;
      if (appMeta) {
        userPermissionsRaw = appMeta.permissions ?? appMeta.permisos ?? null;
      }
    }

    if (!userPermissionsRaw) {
      this.logger.error("❌ No se encontraron permisos en ninguna parte del objeto usuario.");
      throw new InternalServerErrorException(
        "Los permisos del usuario no están disponibles o no tienen el formato esperado."
      );
    }

    // Normalizar a string[]
    const userPermissions = this.normalizePermissions(userPermissionsRaw);

    this.logger.log(`✅ Permisos del usuario: ${userPermissions.join(", ")}`);

    // Verificar que el usuario tenga todos los permisos requeridos
    // Usando la función helper que soporta permisos granulares
    const hasAll = requiredPermissions.every((requiredPerm) =>
      hasPermission(userPermissions, requiredPerm)
    );

    if (!hasAll) {
      const missingPerms = requiredPermissions.filter(
        (perm) => !hasPermission(userPermissions, perm)
      );
      this.logger.warn(
        `🚫 Usuario no tiene los permisos requeridos. Faltan: ${missingPerms.join(", ")}`
      );
      throw new ForbiddenException(
        `No tiene los permisos necesarios para acceder a este recurso. Permisos faltantes: ${missingPerms.join(", ")}`
      );
    }

    this.logger.log("🟢 Acceso permitido.");
    return true;
  }

  /**
   * Normaliza los permisos del usuario a un array de strings
   */
  private normalizePermissions(permissionsRaw: any): string[] {
    const permissions: string[] = [];

    if (Array.isArray(permissionsRaw)) {
      permissionsRaw.forEach((p) => {
        if (typeof p === "string") {
          permissions.push(p);
        } else if (p && (p.nombre || p.name || p.key)) {
          permissions.push(String(p.nombre ?? p.name ?? p.key));
        }
      });
    } else if (typeof permissionsRaw === "string") {
      permissionsRaw
        .split(",")
        .map((s) => s.trim())
        .forEach((s) => permissions.push(s));
    } else if (typeof permissionsRaw === "object") {
      Object.values(permissionsRaw).forEach((v) => {
        if (typeof v === "string") permissions.push(v);
      });
    } else {
      this.logger.error(`❌ Formato desconocido para permisos: ${typeof permissionsRaw}`);
      throw new InternalServerErrorException("Formato desconocido para permisos del usuario.");
    }

    return permissions;
  }
}
