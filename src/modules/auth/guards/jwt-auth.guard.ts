import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  InternalServerErrorException,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SupabaseService } from "../../supabase/supabase.service";
import { AuthService } from "../../auth/auth.service";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly authCache = new Map<string, { userObj: any; expiresAt: number }>();
  private readonly inFlightAuth = new Map<string, Promise<any>>();
  private readonly CACHE_TTL_MS = 60_000; // 60s de caché en memoria para evitar N+1 por petición

  constructor(
    private reflector: Reflector,
    private readonly supabaseService: SupabaseService,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedException("Token no proporcionado o formato inválido");
    }

    const token = authHeader.replace("Bearer ", "");
    const now = Date.now();

    // ✅ Fast-path: retornar desde caché en memoria si sigue vigente
    const cached = this.authCache.get(token);
    if (cached && cached.expiresAt > now) {
      request.user = cached.userObj;
      return true;
    }

    try {
      let pending = this.inFlightAuth.get(token);
      if (!pending) {
        pending = this.resolveAuthenticatedUser(token).finally(() => {
          this.inFlightAuth.delete(token);
        });
        this.inFlightAuth.set(token, pending);
      }

      const userObj = await pending;
      request.user = userObj;
      return true;
    } catch (error) {
      this.authCache.delete(token);
      console.error("❌ [JwtAuthGuard] Error de autenticación:", error?.message || error);
      throw new UnauthorizedException("Token inválido o expirado.");
    }
  }

  private async resolveAuthenticatedUser(token: string): Promise<any> {
    // ✅ Verificar el token con Supabase
    const user = await this.supabaseService.verifyToken(token);

    if (!user?.id) {
      throw new UnauthorizedException("Usuario no encontrado en el token.");
    }

    // ✅ Obtener el perfil completo y empleado_id en paralelo
    const supabase = this.supabaseService.getClient();
    const [perfil, empleadoRes] = await Promise.all([
      this.authService.getProfile(user.id, token),
      supabase
        .from('empleados')
        .select('id')
        .eq('usuario_id', user.id)
        .maybeSingle(),
    ]);

    if (!perfil?.user) {
      throw new InternalServerErrorException("No se pudo obtener el perfil completo del usuario.");
    }

    const empleadoId = empleadoRes?.data?.id || null;

    const userObj = {
      ...user,
      ...perfil.user,
      empleadoId: empleadoId, // 🔥 Agregado para endpoints de supervisor/empleado
      permisos: perfil.permisos, // 🔥 clave: el guard los podrá leer
    };

    if (this.authCache.size > 500) {
      const oldestKey = this.authCache.keys().next().value;
      if (oldestKey) this.authCache.delete(oldestKey);
    }
    this.authCache.set(token, {
      userObj,
      expiresAt: Date.now() + this.CACHE_TTL_MS,
    });

    return userObj;
  }
}
