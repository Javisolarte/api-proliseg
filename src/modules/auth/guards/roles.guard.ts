import { Injectable, type CanActivate, type ExecutionContext, ForbiddenException } from "@nestjs/common"
import  { Reflector } from "@nestjs/core"
import { ROLES_KEY } from "../decorators/roles.decorator"

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!requiredRoles) {
      return true
    }

    const { user } = context.switchToHttp().getRequest()

    if (!user || !user.rol) {
      throw new ForbiddenException("No tiene permisos para acceder a este recurso")
    }

    const hasRole = requiredRoles.includes(user.rol)

    if (!hasRole) {
      throw new ForbiddenException("No tiene el rol necesario para acceder a este recurso")
    }

    return true
  }
}
