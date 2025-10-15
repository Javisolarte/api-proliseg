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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { Request } from 'express';


@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  /**
   * 🔐 LOGIN - Autentica un usuario y devuelve tokens + permisos
   */
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
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Obtener el perfil completo del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Perfil obtenido exitosamente' })
  @ApiResponse({ status: 401, description: 'No autorizado o token inválido' })
  async getProfile(@CurrentUser() user: any) {
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
  @UseGuards(JwtAuthGuard)
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
}
