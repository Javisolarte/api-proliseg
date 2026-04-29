import { Controller, Post, Get, Param, Res, Logger, Req, Body, Query } from '@nestjs/common';
import { ControlAccesoService } from './control-acceso.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { CreateDispositivoDto, CreatePersonaAccesoDto } from './dto/control-acceso.dto';

@ApiTags('Control de Acceso')
@Controller('control-acceso')
export class ControlAccesoController {
  private readonly logger = new Logger(ControlAccesoController.name);

  constructor(private readonly controlAccesoService: ControlAccesoService) { }

  @Post('comando')
  @ApiOperation({ summary: 'Envía un comando de puerta (abrir, cerrar, bloqueo, siempre-abierta)' })
  async enviarComando(@Body() body: { ip: string, doorId?: number, command: 'abrir' | 'cerrar' | 'siempre-abierta' | 'siempre-cerrada' }) {
    this.logger.log(`🚪 [COMANDO] Enviando ${body.command} a la IP ${body.ip}`);
    return this.controlAccesoService.controlPuerta(body.ip, body.doorId || 1, body.command);
  }

  @Get('dispositivos')
  @ApiOperation({ summary: 'Obtener lista de dispositivos IoT registrados' })
  async getDispositivos() {
    return this.controlAccesoService.findAllDispositivos();
  }

  @Get('personas')
  @ApiOperation({ summary: 'Obtener lista de personas en el sistema' })
  async getPersonas() {
    return this.controlAccesoService.findAllPersonas();
  }

  @Post('sync-hardware')
  @ApiOperation({ summary: 'Extrae usuarios y rostros directamente del hardware' })
  async syncHardware(@Body() body: { ip: string }) {
    this.logger.log(`🔄 [SYNC] Extrayendo datos del hardware en ${body.ip}`);
    return this.controlAccesoService.syncUsuariosHardware(body.ip);
  }

  @Post('subir-rostro')
  @ApiOperation({ summary: 'Sincroniza foto de rostro al hardware' })
  async subirRostro(@Body() body: { ip: string, userId: string, faceBase64: string }) {
    this.logger.log(`👤 [ROSTRO] Subiendo cara para el usuario ${body.userId} en ${body.ip}`);
    return this.controlAccesoService.uploadRostro(body.ip, body.userId, body.faceBase64);
  }

  @Get('scan')
  @ApiOperation({ summary: 'Escanea la red en busca de dispositivos Hikvision/VMS' })
  async scanNetwork(@Query('range') range: string) {
    return this.controlAccesoService.scanNetwork(range);
  }

  @Post('validar-credenciales')
  @ApiOperation({ summary: 'Valida usuario y contraseña contra un hardware específico' })
  async validarCredenciales(@Body() body: { ip: string, user: string, pass: string }) {
    return this.controlAccesoService.validateCredentials(body.ip, body.user, body.pass);
  }


  @Public()
  @Get('snapshot')
  @ApiOperation({ summary: 'Obtiene captura en vivo del dispositivo' })
  async getSnapshot(@Query('ip') ip: string, @Res() res: Response) {
    try {
      const buffer = await this.controlAccesoService.getSnapshot(ip || '192.168.1.117');
      res.set({
        'Content-Type': 'image/jpeg',
        'Content-Length': buffer.length,
        'Cache-Control': 'no-cache',
      });
      res.send(buffer);
    } catch (error) {
      res.status(500).send({ message: 'Error snapshot' });
    }
  }
}
