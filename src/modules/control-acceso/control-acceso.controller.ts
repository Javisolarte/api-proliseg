import { Controller, Post, Get, Param, Res, Logger, Req, Body, Query, BadRequestException } from '@nestjs/common';
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

  @Post('dispositivos')
  @ApiOperation({ summary: 'Registrar un nuevo dispositivo IoT' })
  async createDispositivo(@Body() body: any) {
    return this.controlAccesoService.createDispositivo(body);
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
  async scanNetwork(
    @Query('range') range: string,
    @Query('mikrotikIp') mikrotikIp?: string,
    @Query('mikrotikUser') mikrotikUser?: string,
    @Query('mikrotikPass') mikrotikPass?: string,
    @Query('mikrotikPort') mikrotikPort?: string
  ) {
    try {
      return await this.controlAccesoService.scanNetwork(range, { mikrotikIp, mikrotikUser, mikrotikPass, mikrotikPort });
    } catch (error) {
      this.logger.error(`❌ [SCAN ERROR CONTROLLER]: ${error.message}`);
      throw new BadRequestException(error.message || 'Error al conectar con la API de MikroTik');
    }
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

  @Get('recopilacion/lugares')
  @ApiOperation({ summary: 'Lista lugares de recopilacion de datos' })
  async getLugaresRecopilacion() {
    return this.controlAccesoService.getLugaresRecopilacion();
  }

  @Post('recopilacion/lugares')
  @ApiOperation({ summary: 'Crea lugar y link de recopilacion de datos' })
  async createLugarRecopilacion(
    @Body() body: {
      nombre_lugar: string;
      descripcion?: string;
      requiere_torre?: boolean;
      codigo_seguridad?: string;
      creado_por?: number;
    }
  ) {
    return this.controlAccesoService.createLugarRecopilacion(body);
  }

  @Get('recopilacion/lugares/:lugarId/registros')
  @ApiOperation({ summary: 'Lista registros de recopilacion por lugar' })
  async getRegistrosRecopilacion(@Param('lugarId') lugarId: string) {
    return this.controlAccesoService.getRegistrosRecopilacion(Number(lugarId));
  }

  @Public()
  @Get('recopilacion/public/:token')
  @ApiOperation({ summary: 'Obtiene metadata publica del formulario por token' })
  async getPublicForm(@Param('token') token: string) {
    return this.controlAccesoService.getPublicForm(token);
  }

  @Public()
  @Post('recopilacion/public/:token/validar-codigo')
  @ApiOperation({ summary: 'Valida codigo de seguridad del formulario publico' })
  async validarCodigo(@Param('token') token: string, @Body() body: { codigo_seguridad: string }) {
    return this.controlAccesoService.validarCodigo(token, body?.codigo_seguridad || '');
  }

  @Public()
  @Post('recopilacion/public/:token/registrar')
  @ApiOperation({ summary: 'Registra datos del formulario publico con consentimiento' })
  async registrarPublico(
    @Param('token') token: string,
    @Body() body: any,
    @Req() req: any
  ) {
    return this.controlAccesoService.registrarPublico(token, body, req);
  }

  // --- ENDPOINTS DE CONFIGURACIÓN (SERVIDORES MIKROTIK & MODELOS DISPOSITIVOS) ---

  @Get('config/servidores')
  @ApiOperation({ summary: 'Obtiene lista de servidores MikroTik registrados' })
  async getServidoresMikrotik() {
    return this.controlAccesoService.findServidoresMikrotik();
  }

  @Post('config/servidores')
  @ApiOperation({ summary: 'Crea/registra un servidor MikroTik' })
  async createServidorMikrotik(@Body() body: any) {
    return this.controlAccesoService.createServidorMikrotik(body);
  }

  @Post('config/servidores/:id/delete')
  @ApiOperation({ summary: 'Elimina un servidor MikroTik' })
  async deleteServidorMikrotik(@Param('id') id: string) {
    return this.controlAccesoService.deleteServidorMikrotik(Number(id));
  }

  @Get('config/modelos')
  @ApiOperation({ summary: 'Obtiene lista de modelos de dispositivos' })
  async getModelosDispositivos() {
    return this.controlAccesoService.findModelosDispositivos();
  }

  @Post('config/modelos')
  @ApiOperation({ summary: 'Crea/registra un modelo de dispositivo' })
  async createModeloDispositivo(@Body() body: any) {
    return this.controlAccesoService.createModeloDispositivo(body);
  }

  @Post('config/modelos/:id/delete')
  @ApiOperation({ summary: 'Elimina un modelo de dispositivo' })
  async deleteModeloDispositivo(@Param('id') id: string) {
    return this.controlAccesoService.deleteModeloDispositivo(Number(id));
  }
}
