import { Controller, Post, Get, Param, Res } from '@nestjs/common';
import { ControlAccesoService } from './control-acceso.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Control de Acceso')
@Controller('control-acceso')
export class ControlAccesoController {
  constructor(private readonly controlAccesoService: ControlAccesoService) {}

  @Post('abrir/:id')
  @ApiOperation({ summary: 'Abre una puerta remota' })
  async abrirPuerta(@Param('id') id: string) {
    return this.controlAccesoService.abrirPuerta(parseInt(id));
  }

  @Get('info')
  @ApiOperation({ summary: 'Obtiene información del dispositivo de acceso' })
  async getInfo() {
    return this.controlAccesoService.getDeviceInfo();
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
      res.status(500).send({ message: 'Error obteniendo captura de video' });
    }
  }
}
