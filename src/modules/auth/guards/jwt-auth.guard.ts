import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  InternalServerErrorException,
} from "@nestjs/common";
import { SupabaseService } from "../../supabase/supabase.service";
import { AuthService } from "../../auth/auth.service";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly authService: AuthService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedException("Token no proporcionado o formato inválido");
    }

    const token = authHeader.replace("Bearer ", "");

    try {
      // ✅ Verificar el token con Supabase
      const user = await this.supabaseService.verifyToken(token);

      if (!user?.id) {
        throw new UnauthorizedException("Usuario no encontrado en el token.");
      }

      // ✅ Obtener el perfil completo con permisos
      const perfil = await this.authService.getProfile(user.id, token);

      if (!perfil?.user) {
        throw new InternalServerErrorException("No se pudo obtener el perfil completo del usuario.");
      }

      // ✅ Inyectar usuario completo con permisos al request
      request.user = {
        ...user,
        ...perfil.user,
        permisos: perfil.permisos, // 🔥 clave: el guard los podrá leer
      };

      console.log("🧩 [JwtAuthGuard] Usuario autenticado con permisos:", {
        id: perfil.user.id,
        nombre: perfil.user.nombre_completo,
        totalPermisos: perfil.permisos?.length || 0,
      });

      return true;
    } catch (error) {
      console.error("❌ [JwtAuthGuard] Error de autenticación:", error);
      throw new UnauthorizedException("Token inválido o expirado.");
    }
  }
}
