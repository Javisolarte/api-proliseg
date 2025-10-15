// permissions.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  InternalServerErrorException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions =
      this.reflector.get<string[]>(PERMISSIONS_KEY, context.getHandler()) || [];

    console.log("🧩 [PermissionsGuard] → Permisos requeridos:", requiredPermissions);

    // Si no hay permisos requeridos, dejar pasar
    if (!requiredPermissions || requiredPermissions.length === 0) {
      console.log("✅ [PermissionsGuard] → No se requieren permisos para esta ruta.");
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    console.log("👤 [PermissionsGuard] → Usuario en request:", user);

    if (!user) {
      console.error("⛔ [PermissionsGuard] → No hay usuario autenticado en la request.");
      throw new ForbiddenException("Usuario no autenticado o no presente en la petición.");
    }

    // Intentar obtener permisos desde varias posibles ubicaciones
    let userPermissionsRaw = user.permissions ?? user.permisos ?? null;

    if (!userPermissionsRaw) {
      console.log("⚠️ [PermissionsGuard] → Intentando obtener permisos desde metadatos...");
      const appMeta = user.app_metadata ?? user.user_metadata ?? null;
      if (appMeta) {
        userPermissionsRaw = appMeta.permissions ?? appMeta.permisos ?? null;
      }
    }

    console.log("📦 [PermissionsGuard] → Permisos crudos del usuario:", userPermissionsRaw);

    if (!userPermissionsRaw) {
      console.error("❌ [PermissionsGuard] → No se encontraron permisos en ninguna parte del objeto usuario.");
      throw new InternalServerErrorException(
        "Los permisos del usuario no están disponibles o no tienen el formato esperado."
      );
    }

    // Normalizar a Set<string>
    const userPermissionsNames = new Set<string>();

    if (Array.isArray(userPermissionsRaw)) {
      console.log("🔍 [PermissionsGuard] → userPermissionsRaw es un array.");
      userPermissionsRaw.forEach((p) => {
        if (typeof p === "string") userPermissionsNames.add(p);
        else if (p && (p.nombre || p.name || p.key)) {
          userPermissionsNames.add(String(p.nombre ?? p.name ?? p.key));
        }
      });
    } else if (typeof userPermissionsRaw === "string") {
      console.log("🔍 [PermissionsGuard] → userPermissionsRaw es una cadena separada por comas.");
      userPermissionsRaw
        .split(",")
        .map((s) => s.trim())
        .forEach((s) => userPermissionsNames.add(s));
    } else if (typeof userPermissionsRaw === "object") {
      console.log("🔍 [PermissionsGuard] → userPermissionsRaw es un objeto.");
      Object.values(userPermissionsRaw).forEach((v) => {
        if (typeof v === "string") userPermissionsNames.add(v);
      });
    } else {
      console.error("❌ [PermissionsGuard] → Formato desconocido para permisos del usuario:", typeof userPermissionsRaw);
      throw new InternalServerErrorException("Formato desconocido para permisos del usuario.");
    }

    console.log("✅ [PermissionsGuard] → Permisos normalizados del usuario:", [...userPermissionsNames]);

    // Verificar que el usuario tenga todos los permisos requeridos
    const hasAll = requiredPermissions.every((r) => userPermissionsNames.has(r));

    console.log(
      `🔎 [PermissionsGuard] → Verificando permisos. Requeridos: ${requiredPermissions.join(", ")} | Usuario tiene: ${[...userPermissionsNames].join(", ")}`
    );

    if (!hasAll) {
      console.warn("🚫 [PermissionsGuard] → Usuario no tiene todos los permisos requeridos.");
      throw new ForbiddenException("No tiene los permisos necesarios para acceder a este recurso.");
    }

    console.log("🟢 [PermissionsGuard] → Acceso permitido.");
    return true;
  }
}
