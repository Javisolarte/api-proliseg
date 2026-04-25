import { Controller, Post, Get, Param, Res, Logger, Req, Body } from '@nestjs/common';
import { ControlAccesoService } from './control-acceso.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { CreateDispositivoDto, CreatePersonaAccesoDto } from './dto/control-acceso.dto';

@ApiTags('Control de Acceso')
@Controller('control-acceso')
export class ControlAccesoController {
  private readonly logger = new Logger(ControlAccesoController.name);

  constructor(private readonly controlAccesoService: ControlAccesoService) {}

  @Post('abrir-puerta')
  @ApiOperation({ summary: 'Abre una puerta remota' })
  async abrirPuerta(@Body() body: { puestoId: number }) {
    return this.controlAccesoService.abrirPuerta(body.puestoId);
  }

  @Get('dispositivos')
  @ApiOperation({ summary: 'Obtener lista de dispositivos IoT' })
  async getDispositivos() {
    return this.controlAccesoService.findAllDispositivos();
  }

  @Post('dispositivos')
  @ApiOperation({ summary: 'Registrar nuevo dispositivo' })
  async createDispositivo(@Body() dto: CreateDispositivoDto) {
    return this.controlAccesoService.createDispositivo(dto);
  }

  @Get('personas')
  @ApiOperation({ summary: 'Obtener lista de personas con acceso' })
  async getPersonas() {
    return this.controlAccesoService.findAllPersonas();
  }

  @Post('personas')
  @ApiOperation({ summary: 'Sincronizar nueva persona al sistema' })
  async createPersona(@Body() dto: CreatePersonaAccesoDto) {
    return this.controlAccesoService.createPersona(dto);
  }

  @Get('logs')
  @ApiOperation({ summary: 'Historial global de accesos y aperturas' })
  async getLogs() {
    return this.controlAccesoService.findAllLogs();
  }

  @Post('cerrar/:id')
  @ApiOperation({ summary: 'Cierra una puerta remota' })
  async cerrarPuerta(@Param('id') id: string) {
    return this.controlAccesoService.cerrarPuerta(parseInt(id));
  }

  @Get('escanear-red')
  @ApiOperation({ summary: 'Busca equipos en la red a través del túnel' })
  async escanearRed(@Req() req: any) {
    const baseIp = req.query.base as string;
    this.logger.log(`Radar encendido. Buscando equipos en subred: ${baseIp || 'default'}`);
    return this.controlAccesoService.escanearRed(baseIp);
  }

  @Post('validar-equipo')
  @ApiOperation({ summary: 'Valida credenciales ISAPI con el equipo real' })
  async validarEquipo(@Body() body: any) {
    this.logger.log(`Validando credenciales en IP: ${body.ip}`);
    return this.controlAccesoService.validarEquipo(body.ip, body.usuario, body.password);
  }

  @Post('siempre-abierta/:id')
  @ApiOperation({ summary: 'Mantiene la puerta abierta' })
  async siempreAbierta(@Param('id') id: string) {
    return this.controlAccesoService.siempreAbierta(parseInt(id));
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
