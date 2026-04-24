import { Controller, Post, Get, Param, Res, Logger } from '@nestjs/common';
import { ControlAccesoService } from './control-acceso.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Control de Acceso')
@Controller('control-acceso')
export class ControlAccesoController {
  private readonly logger = new Logger(ControlAccesoController.name);

  constructor(private readonly controlAccesoService: ControlAccesoService) {}

  @Post('abrir/:id')
  @ApiOperation({ summary: 'Abre una puerta remota' })
  async abrirPuerta(@Param('id') id: string) {
    this.logger.warn(`🔔 [CONTROLLER] Recibida solicitud de apertura puerta ${id} desde Angular`);
    try {
      const result = await this.controlAccesoService.abrirPuerta(parseInt(id));
      this.logger.log(`✅ [CONTROLLER] Puerta ${id} abierta exitosamente`);
      return result;
    } catch (error) {
      this.logger.error(`❌ [CONTROLLER] Error abriendo puerta ${id}: ${error.message}`);
      throw error;
    }
  }

  @Get('info')
  @ApiOperation({ summary: 'Obtiene información del dispositivo de acceso' })
  async getInfo() {
    this.logger.log(`📡 [CONTROLLER] Solicitando info del dispositivo`);
    try {
      const result = await this.controlAccesoService.getDeviceInfo();
      this.logger.log(`✅ [CONTROLLER] Info del dispositivo obtenida`);
      return result;
    } catch (error) {
      this.logger.error(`❌ [CONTROLLER] Error obteniendo info: ${error.message}`);
      throw error;
    }
  }

  @Public()
  @Get('video/snapshot')
  @ApiOperation({ summary: 'Obtiene fotograma en vivo para el monitor' })
  async getSnapshot(@Res() res: Response) {
    try {
      const buffer = await this.controlAccesoService.getSnapshot();
      res.set({
        'Content-Type': 'image/jpeg',
        'Content-Length': buffer.length,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      });
      res.send(buffer);
    } catch (error) {
      this.logger.error(`❌ [CONTROLLER] Error snapshot: ${error.message}`);
      res.status(500).send({ message: 'Error obteniendo captura de video' });
    }
  }
}
