import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  Req,
  Patch,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, UpdateUserDto, UpdateStatusDto, ForgotPasswordDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import type { Request } from 'express';


@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) { }

  /**
   * 🔐 LOGIN - Autentica un usuario y devuelve tokens + permisos
   */
  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Iniciar sesión y obtener token JWT' })
  @ApiResponse({ status: 200, description: 'Login exitoso' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o incompletos' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
    this.logger.log(`📥 [LOGIN] Body recibido: ${JSON.stringify(loginDto, null, 2)}`);

    if (!loginDto?.email || !loginDto?.password) {
      this.logger.warn('⚠️ Faltan credenciales en la solicitud');
      throw new BadRequestException('Debe enviar email y contraseña.');
    }

    try {
      const result = await this.authService.login(loginDto, req);
      this.logger.log(`✅ [LOGIN] Usuario autenticado correctamente: ${loginDto.email}`);
      return result;
    } catch (error) {
      this.logger.error(`❌ [LOGIN] Error: ${error.message}`);
      throw error instanceof BadRequestException
        ? error
        : new InternalServerErrorException(error.message);
    }
  }

  /**
   * 🧾 REGISTER - Crea un nuevo usuario con rol y registro en Supabase
   */
  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Registrar un nuevo usuario en Supabase y base de datos' })
  @ApiResponse({ status: 201, description: 'Usuario creado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o duplicados' })
  async register(@Body() registerDto: RegisterDto) {
    this.logger.log(`📥 [REGISTER] Body recibido: ${JSON.stringify(registerDto, null, 2)}`);

    if (!registerDto.email || !registerDto.password) {
      throw new BadRequestException('Debe proporcionar email y contraseña.');
    }

    try {
      const result = await this.authService.register(registerDto);
      this.logger.log(`✅ [REGISTER] Usuario registrado exitosamente: ${registerDto.email}`);
      return result;
    } catch (error) {
      this.logger.error(`❌ [REGISTER] Error: ${error.message}`);
      throw error instanceof BadRequestException
        ? error
        : new InternalServerErrorException(error.message);
    }
  }

  /**
   * 👤 PROFILE - Retorna información completa del usuario autenticado
   */
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Obtener el perfil completo del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Perfil obtenido exitosamente' })
  @ApiResponse({ status: 401, description: 'No autorizado o token inválido' })
  async getProfile(@CurrentUser() user: any) {
    if (!user || !user.id) {
      throw new BadRequestException('Usuario no autenticado o no encontrado en el token');
    }
    this.logger.log(`👤 [PROFILE] Solicitado por: ${user?.email || user?.id}`);

    try {
      const result = await this.authService.getProfile(user.id);
      this.logger.log(`✅ [PROFILE] Perfil obtenido correctamente: ${user?.email}`);
      return result;
    } catch (error) {
      this.logger.error(`❌ [PROFILE] Error: ${error.message}`);
      throw new InternalServerErrorException('Error al obtener el perfil del usuario.');
    }
  }

  /**
   * 🚪 LOGOUT - Cierra la sesión del usuario
   */
  @Post('logout')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Cerrar sesión del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Sesión cerrada exitosamente' })
  async logout(@CurrentUser() user: any, @Req() req: Request, @Body('token') token?: string) {
    this.logger.log(`🚪 [LOGOUT] Solicitud de logout por: ${user?.email}`);

    try {
      const authHeader = req.headers['authorization'];
      const bearerToken = authHeader?.split(' ')[1] || token;
      const result = await this.authService.logout(user, bearerToken);
      return result;
    } catch (error) {
      this.logger.error(`❌ [LOGOUT] Error: ${error.message}`);
      throw new InternalServerErrorException('Error al cerrar sesión.');
    }
  }

  /**
   * 🔄 UPDATE USER - Actualiza los datos de un usuario por su ID (serial)
   */
  @Patch('update/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Actualizar datos de un usuario' })
  @ApiResponse({ status: 200, description: 'Usuario actualizado correctamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o usuario no encontrado' })
  async updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto
  ) {
    this.logger.log(`📥 [UPDATE] ID: ${id}, Body: ${JSON.stringify(updateUserDto)}`);
    return await this.authService.updateUser(id, updateUserDto);
  }

  /**
   * 🏷️ STATUS - Cambia el estado activo/inactivo de un usuario
   */
  @Patch('status/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Cambiar estado (activo/inactivo) de un usuario' })
  @ApiResponse({ status: 200, description: 'Estado actualizado correctamente' })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStatusDto: UpdateStatusDto
  ) {
    this.logger.log(`📥 [STATUS] ID: ${id}, Estado: ${updateStatusDto.estado}`);
    return await this.authService.updateStatus(id, updateStatusDto.estado);
  }

  /**
   * 📧 FORGOT PASSWORD - Inicia el proceso de recuperación de contraseña
   */
  @Public()
  @Post('forgot-password')
  @ApiOperation({ summary: 'Solicitar recuperación de contraseña por email' })
  @ApiResponse({ status: 200, description: 'Correo de recuperación enviado' })
  @ApiResponse({ status: 400, description: 'Email no válido o no encontrado' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    this.logger.log(`📥 [FORGOT-PASSWORD] Email: ${forgotPasswordDto.email}`);
    return await this.authService.forgotPassword(forgotPasswordDto);
  }
}
