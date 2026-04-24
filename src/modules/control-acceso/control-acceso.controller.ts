import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { ControlAccesoService } from './control-acceso.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

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
}
