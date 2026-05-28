import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoginDto, RegisterDto, UpdateUserDto, ForgotPasswordDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly supabaseService: SupabaseService) { }

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

      // 📌 Registrar sesión en la tabla sesiones_usuario en segundo plano (asíncrono) para no demorar la respuesta de login
      supabase
        .from('sesiones_usuario')
        .insert({
          usuario_id: usuarioExterno.id,
          token_sesion: data.session.access_token,
          ip_address: ipAddress,
          user_agent: userAgent,
          activa: true,
        })
        .then(({ error: sesionError }) => {
          if (sesionError) {
            this.logger.error(`⚠️ Error al registrar sesión: ${sesionError.message}`);
          } else {
            this.logger.log(`🟢 Sesión registrada correctamente en segundo plano para ${loginDto.email}`);
          }
        });

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
        this.logger.error(`❌ Error de Supabase Auth: ${authError.message}`);
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
        this.logger.error(`❌ Error de Base de Datos (usuarios_externos): ${userError.message}`);
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

  /**
   * 🔄 UPDATE USER: Actualiza datos del usuario en la tabla y en Auth si cambia el email
   */
  async updateUser(id: number, updateUserDto: UpdateUserDto) {
    const supabaseAdmin = this.supabaseService.getSupabaseAdminClient();

    try {
      this.logger.log(`🔄 Actualizando usuario ID: ${id}`);

      // 1. Obtener el user_id (UUID) actual de la tabla usuarios_externos
      const { data: currentUser, error: findError } = await supabaseAdmin
        .from('usuarios_externos')
        .select('user_id, correo')
        .eq('id', id)
        .single();

      if (findError || !currentUser) {
        this.logger.error(`❌ Error al buscar usuario: ${findError?.message}`);
        throw new BadRequestException('Usuario no encontrado.');
      }

      // 2. Si el email cambió, actualizarlo en Supabase Auth
      if (updateUserDto.email && updateUserDto.email !== currentUser.correo) {
        this.logger.log(`📧 Actualizando correo en Auth: ${currentUser.correo} -> ${updateUserDto.email}`);
        const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
          currentUser.user_id,
          { email: updateUserDto.email }
        );

        if (authUpdateError) {
          this.logger.error(`❌ Error Auth: ${authUpdateError.message}`);
          throw new BadRequestException({
            message: 'Error al actualizar el correo en Supabase Auth',
            supabase_error: authUpdateError.message,
          });
        }
      }

      // 3. Actualizar datos en la tabla usuarios_externos
      const updateData: any = { ...updateUserDto };
      if (updateUserDto.email) {
        updateData.correo = updateUserDto.email;
        delete updateData.email; // Asegurar que mapee a 'correo'
      }

      const { data: updatedUser, error: updateError } = await supabaseAdmin
        .from('usuarios_externos')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        this.logger.error(`❌ Error DB: ${updateError.message}`);
        throw new BadRequestException({
          message: 'Error al actualizar usuario en base de datos',
          supabase_error: updateError.message,
        });
      }

      return {
        success: true,
        message: 'Usuario actualizado correctamente',
        user: updatedUser,
      };
    } catch (err) {
      this.logger.error(`❌ Error en updateUser: ${err.message}`);
      throw err instanceof BadRequestException
        ? err
        : new InternalServerErrorException('Error interno al actualizar usuario.');
    }
  }

  /**
   * 🟢🔴 UPDATE STATUS: Cambia el estado (activo/inactivo) de un usuario
   */
  async updateStatus(id: number, status: boolean) {
    const supabaseAdmin = this.supabaseService.getSupabaseAdminClient();

    try {
      this.logger.log(`🏷️ Cambiando estado de usuario ID ${id} a ${status}`);

      const { data, error } = await supabaseAdmin
        .from('usuarios_externos')
        .update({ estado: status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        this.logger.error(`❌ Error DB status: ${error.message}`);
        throw new BadRequestException({
          message: 'Error al actualizar el estado del usuario',
          supabase_error: error.message,
        });
      }

      return {
        success: true,
        message: `Estado del usuario actualizado a ${status ? 'activo' : 'inactivo'}`,
        user: data,
      };
    } catch (err) {
      this.logger.error(`❌ Error en updateStatus: ${err.message}`);
      throw err instanceof BadRequestException
        ? err
        : new InternalServerErrorException('Error interno al actualizar estado.');
    }
  }

  /**
   * 📧 FORGOT PASSWORD: Envía correo de recuperación de contraseña
   */
  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const supabase = this.supabaseService.getClient();

    try {
      this.logger.log(`📧 Enviando recuperación a: ${forgotPasswordDto.email}`);

      const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordDto.email);

      if (error) {
        throw new BadRequestException({
          message: 'Error al enviar correo de recuperación',
          supabase_error: error.message,
        });
      }

      return {
        success: true,
        message: 'Se ha enviado un correo para restablecer la contraseña.',
      };
    } catch (err) {
      this.logger.error(`❌ Error en forgotPassword: ${err.message}`);
      throw err instanceof BadRequestException
        ? err
        : new InternalServerErrorException('Error interno al procesar recuperación de contraseña.');
    }
  }

  /**
   * 🔐 Validar Token (Para WebSockets/Gateways)
   */
  async validateToken(token: string) {
    const supabase = this.supabaseService.getClient();

    try {
      if (!token) {
        throw new UnauthorizedException('Token no proporcionado');
      }

      const { data, error } = await supabase.auth.getUser(token);

      if (error || !data.user) {
        this.logger.warn(`❌ Token inválido en WebSocket: ${error?.message}`);
        throw new UnauthorizedException('Token inválido');
      }

      // Obtener rol del usuario desde metadata o tabla usuarios_externos
      // Esto es opcional, pero útil para RBAC en el gateway
      return {
        user_id: data.user.id,
        email: data.user.email,
        valid: true
      };
    } catch (error) {
      return null;
    }
  }
}