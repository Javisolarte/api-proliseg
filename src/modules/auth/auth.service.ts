import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  // 🔹 Combinar y formatear permisos
  private formatearPermisos(permisos: any[]) {
    const permisosUnicos = Array.from(
      new Map(
        permisos.map((p) => [p.modulos.id, p.modulos])
      ).values()
    );

    return permisosUnicos.map((m) => ({
      id: m.id,
      nombre: m.nombre,
      descripcion: m.descripcion,
      categoria: m.categoria,
      parent_id: m.parent_id,
    }));
  }

/**
 * 🚪 LOGOUT: Marca la sesión como inactiva en la base de datos
 */
async logout(user: any, accessToken?: string) {
  const supabase = this.supabaseService.getClient();

  try {
    this.logger.log(`🚪 Cerrando sesión del usuario ID: ${user?.id}`);

    if (!user?.id) {
      throw new BadRequestException('Usuario no válido para cerrar sesión.');
    }

    // ✅ Buscar la sesión activa del usuario con ese token
    const { data: sesionActiva, error: findError } = await supabase
      .from('sesiones_usuario')
      .select('*')
      .eq('usuario_id', user.id)
      .eq('token_sesion', accessToken)
      .eq('activa', true)
      .maybeSingle();

    if (findError) {
      throw new InternalServerErrorException({
        message: 'Error al buscar la sesión activa.',
        supabase_error: findError.message,
      });
    }

    if (!sesionActiva) {
      this.logger.warn('⚠️ No se encontró una sesión activa para cerrar.');
      return { success: false, message: 'No hay sesión activa para cerrar.' };
    }

    // 🔹 Actualizar sesión a inactiva
    const { error: updateError } = await supabase
      .from('sesiones_usuario')
      .update({
        activa: false,
        fecha_ultimo_acceso: new Date().toISOString(),
      })
      .eq('id', sesionActiva.id);

    if (updateError) {
      throw new InternalServerErrorException({
        message: 'Error al actualizar estado de la sesión.',
        supabase_error: updateError.message,
      });
    }

    this.logger.log(`✅ Sesión cerrada correctamente para usuario ID: ${user.id}`);

    return {
      success: true,
      message: 'Sesión cerrada exitosamente.',
    };
  } catch (err) {
    this.logger.error(`❌ Error en logout: ${err.message}`);
    throw err instanceof BadRequestException
      ? err
      : new InternalServerErrorException('Error interno al cerrar sesión.');
  }
}

/**
 * 🔐 LOGIN: Autentica un usuario existente y obtiene todos sus permisos
 */
async login(loginDto: LoginDto, req?: any) {
  const supabase = this.supabaseService.getClient();

  try {
    this.logger.log(`🟢 Intentando login de ${loginDto.email}`);

    if (!loginDto?.email || !loginDto?.password) {
      throw new BadRequestException({
        message: 'Faltan credenciales en la solicitud (email o password).',
      });
    }

    // 🔹 Autenticación
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginDto.email,
      password: loginDto.password,
    });

    if (error || !data?.user || !data?.session) {
      throw new UnauthorizedException({
        message: 'Credenciales inválidas',
        supabase_error: error?.message,
      });
    }

    // 🔹 Obtener datos del usuario externo
    const { data: usuarioExterno, error: userError } = await supabase
      .from('usuarios_externos')
      .select('*')
      .eq('user_id', data.user.id)
      .single();

    if (userError) {
      throw new InternalServerErrorException({
        message: 'Error al obtener datos del usuario externo',
        supabase_error: userError.message,
      });
    }

    // 🔹 Permisos del usuario
    const { data: permisosUsuario, error: permisosError } = await supabase
      .from('roles_modulos_usuarios_externos')
      .select('modulo_id, modulos(*)')
      .eq('usuario_id', usuarioExterno.id)
      .eq('concedido', true);

    if (permisosError) {
      throw new InternalServerErrorException({
        message: 'Error al obtener permisos del usuario',
        supabase_error: permisosError.message,
      });
    }

    const permisosFormateados = this.formatearPermisos(permisosUsuario || []);

    // 📌 Registrar sesión en la tabla sesiones_usuario
    const ipAddress =
      req?.ip ||
      req?.headers['x-forwarded-for'] ||
      req?.connection?.remoteAddress ||
      null;
    const userAgent = req?.headers['user-agent'] || 'unknown';

    const { error: sesionError } = await supabase
      .from('sesiones_usuario')
      .insert({
        usuario_id: usuarioExterno.id,
        token_sesion: data.session.access_token,
        ip_address: ipAddress,
        user_agent: userAgent,
        activa: true,
      });

    if (sesionError) {
      this.logger.error(`⚠️ Error al registrar sesión: ${sesionError.message}`);
      // No interrumpe el login, solo registra el error
    } else {
      this.logger.log(`🟢 Sesión registrada correctamente para ${loginDto.email}`);
    }

    this.logger.log(`✅ Login exitoso: ${loginDto.email}`);

    return {
      success: true,
      message: 'Inicio de sesión exitoso',
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: {
        id: data.user.id,
        email: data.user.email,
        ...usuarioExterno,
        permisos: permisosFormateados,
      },
    };
  } catch (err) {
    this.logger.error(`❌ Error en login: ${err.message}`);
    throw err instanceof UnauthorizedException ||
      err instanceof BadRequestException
      ? err
      : new InternalServerErrorException('Error interno en el login.');
  }
}


  /**
   * 🧾 REGISTER: Crea un nuevo usuario con permisos según su rol
   */
  async register(registerDto: RegisterDto) {
    const supabaseAdmin = this.supabaseService.getSupabaseAdminClient();
    const supabase = this.supabaseService.getClient();

    try {
      this.logger.log(`🟢 Registrando nuevo usuario: ${registerDto.email}`);

      // 🔐 Crear usuario en Auth
      const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email: registerDto.email,
          password: registerDto.password,
          email_confirm: true,
          user_metadata: {
            nombre_completo: registerDto.nombre_completo,
            cedula: registerDto.cedula,
            telefono: registerDto.telefono,
            rol: registerDto.rol || 'vigilante',
          },
        });

      if (authError) {
        throw new BadRequestException({
          message: 'Error al registrar usuario en Supabase Auth',
          supabase_error: authError.message,
        });
      }

      if (!authData?.user) {
        throw new BadRequestException(
          'No se recibió información del usuario tras el registro.'
        );
      }

      // 🧩 Insertar datos en la tabla usuarios_externos
      const { data: usuarioExterno, error: userError } = await supabase
        .from('usuarios_externos')
        .insert({
          user_id: authData.user.id,
          nombre_completo: registerDto.nombre_completo,
          cedula: registerDto.cedula,
          correo: registerDto.email,
          telefono: registerDto.telefono,
          rol: registerDto.rol || 'vigilante',
          estado: true,
        })
        .select()
        .single();

      if (userError) {
        // ❌ Revertir creación si falla
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        throw new BadRequestException({
          message: 'Error al crear usuario en base de datos',
          supabase_error: userError.message,
        });
      }

      // ⚙️ Asignar módulos automáticamente (trigger o RPC)
      await supabase.rpc('asignar_modulos_usuario', {
        p_usuario_id: usuarioExterno.id,
      });

      this.logger.log(`✅ Usuario creado exitosamente: ${registerDto.email}`);

      return {
        success: true,
        message: 'Usuario registrado exitosamente',
        user: usuarioExterno,
      };
    } catch (err) {
      this.logger.error(`❌ Error en register: ${err.message}`);
      throw err instanceof BadRequestException
        ? err
        : new InternalServerErrorException('Error interno al registrar usuario.');
    }
  }

  /**
   * 👤 PROFILE: Obtiene el perfil completo con sus permisos
   */
  async getProfile(userIdentifier: string | number, accessToken?: string) {
    const supabase = this.supabaseService.getClient();

    try {
      this.logger.log(`📥 [getProfile] ID recibido: ${userIdentifier}`);

      let userUUID: string;
      if (typeof userIdentifier === 'number') {
        const { data: userData, error: idError } = await supabase
          .from('usuarios_externos')
          .select('user_id')
          .eq('id', userIdentifier)
          .single();

        if (idError || !userData) {
          throw new UnauthorizedException('Usuario no encontrado');
        }

        userUUID = userData.user_id;
      } else {
        userUUID = userIdentifier;
      }

      
      // 🔹 Obtener usuario externo
      const { data: usuarioExterno, error: userError } = await supabase
        .from('usuarios_externos')
        .select('*')
        .eq('user_id', userUUID)
        .single();

      if (userError || !usuarioExterno) {
        throw new UnauthorizedException({
          message: 'Usuario no encontrado',
          supabase_error: userError?.message,
        });
      }

      // 🔹 Obtener permisos del usuario
      const { data: permisosUsuario } = await supabase
        .from('roles_modulos_usuarios_externos')
        .select('modulo_id, modulos(*)')
        .eq('usuario_id', usuarioExterno.id)
        .eq('concedido', true);

      const permisosFormateados = this.formatearPermisos(permisosUsuario || []);

      this.logger.log(`✅ Perfil obtenido correctamente: ${usuarioExterno.correo}`);

      return {
        success: true,
        user: usuarioExterno,
        permisos: permisosFormateados,
        accessToken: accessToken || null,
      };
    } catch (err) {
      this.logger.error(`🚨 Error en getProfile: ${err.message}`);
      throw new InternalServerErrorException(
        'Error interno al obtener perfil de usuario.'
      );
    }
  }
}