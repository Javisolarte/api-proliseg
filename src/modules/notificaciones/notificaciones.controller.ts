import { Controller, Post, Body, Get, Put, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificacionesService } from './notificaciones.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  RegistrarDispositivoDto,
  ConfigurarPreferenciasDto,
  EnviarNotificacionDto
} from './dto/notificaciones.dto';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Notificaciones')
@Controller('api/notificaciones')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) { }

  @Post('dispositivos')
  @ApiOperation({ summary: 'Registrar token de dispositivo (FCM) para Push' })
  async registrarDispositivo(@Request() req, @Body() dto: RegistrarDispositivoDto) {
    const tipo = req.user.tipo === 'empleado' ? 'empleado' : 'usuario';
    return this.notificacionesService.registrarDispositivo(req.user.id, dto, tipo);
  }

  @Put('preferencias')
  @ApiOperation({ summary: 'Configurar preferencias de notificación' })
  async configurarPreferencias(@Request() req, @Body() dto: ConfigurarPreferenciasDto) {
    return this.notificacionesService.configurarPreferencias(req.user.id, dto);
  }

  @Post('enviar')
  @RequirePermissions('sistema', 'enviar_notificacion')
  @ApiOperation({ summary: 'Enviar una notificación manual (Admin)' })
  async enviarNotificacionManual(@Body() dto: EnviarNotificacionDto) {
    if (dto.evento_codigo) {
      return this.notificacionesService.dispararEvento(dto.evento_codigo, {
        destinatarios: dto.destinatarios,
        variables: dto.variables,
        extra: dto.datos_extra
      });
    }
    return { message: 'Se requiere codigo de evento para disparo manual' };
  }

  @Post('procesar-cola')
  @RequirePermissions('sistema', 'admin')
  @ApiOperation({ summary: 'Forzar procesamiento de cola de notificaciones' })
  async forzarProcesamiento() {
    await this.notificacionesService.procesarColaEnvios();
    return { message: 'Cola procesada' };
  }
}
