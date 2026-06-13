import { Controller, Post, Put, Get, Param, Res, Logger, Req, Body, Query, BadRequestException, Delete } from '@nestjs/common';
import { ControlAccesoService } from './control-acceso.service';
import { DevicePollerService } from './device-poller.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateDispositivoDto, CreatePersonaAccesoDto } from './dto/control-acceso.dto';
import axios from 'axios';

@ApiTags('Control de Acceso')
@Controller('control-acceso')
export class ControlAccesoController {
  private readonly logger = new Logger(ControlAccesoController.name);

  constructor(
    private readonly controlAccesoService: ControlAccesoService,
    private readonly devicePoller: DevicePollerService,
  ) { }

  @Post('comando')
  @ApiOperation({ summary: 'Envía un comando de puerta (abrir, cerrar, siempre-abierta, siempre-cerrada). Compatible con Hikvision y Dahua.' })
  async enviarComando(
    @Body() body: {
      ip: string;
      doorId?: number;
      command: 'abrir' | 'cerrar' | 'siempre-abierta' | 'siempre-cerrada';
      deviceId?: string;   // Si se provee, el backend carga usuario/pass/marca automáticamente
      user?: string;
      pass?: string;
      port?: number;
      marca?: string;      // 'hikvision' | 'dahua' | '' (auto-detect)
    },
    @CurrentUser() operator?: any
  ) {
    this.logger.log(`🚪 [COMANDO] Enviando "${body.command}" a la IP ${body.ip} | Puerta ${body.doorId || 1}`);
    const result = await this.controlAccesoService.controlPuerta(
      body.ip,
      body.doorId || 1,
      body.command,
      {
        deviceId: body.deviceId,
        user: body.user,
        pass: body.pass,
        port: body.port,
        marca: body.marca,
        operator: operator,
      }
    );

    if (!result.ok) {
      throw new BadRequestException(result);
    }

    return result;
  }

  @Put('audio-in')
  @ApiOperation({ summary: 'Recibe audio del micrófono y lo reenvía al dispositivo Hikvision' })
  async audioIn(
    @Req() req: any,
    @CurrentUser() operator?: any
  ) {
    const targetIp = String(req.headers['x-target-ip'] || req.headers['x-target-ip'.toLowerCase()] || '').trim();
    const deviceId = String(req.headers['x-target-device-id'] || '').trim() || undefined;

    if (!targetIp && !deviceId) {
      throw new BadRequestException('Falta X-Target-Ip o X-Target-Device-Id');
    }

    return this.controlAccesoService.relayAudioToDevice(req, targetIp, deviceId, operator);
  }

  @Public()
  @Get('audio-out')
  @ApiOperation({ summary: 'Proxy de audio de salida para escuchar el intercomunicador de la cámara' })
  async audioOut(
    @Query('ip') targetIp: string,
    @Query('deviceId') deviceId: string,
    @Res() res: Response
  ) {
    const ip = String(targetIp || '').trim();
    const devId = String(deviceId || '').trim() || undefined;

    if (!ip && !devId) {
      throw new BadRequestException('Falta ip o deviceId');
    }

    return this.controlAccesoService.relayAudioFromDevice(res, ip, devId);
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

  @Post('dispositivos/:id')
  @ApiOperation({ summary: 'Actualizar un dispositivo IoT' })
  async updateDispositivo(@Param('id') id: string, @Body() body: any) {
    return this.controlAccesoService.updateDispositivo(id, body);
  }

  @Post('dispositivos/:id/delete')
  @ApiOperation({ summary: 'Eliminar un dispositivo IoT' })
  async deleteDispositivo(@Param('id') id: string) {
    return this.controlAccesoService.deleteDispositivo(id);
  }

  @Get('personas')
  @ApiOperation({ summary: 'Obtener lista de personas en el sistema' })
  async getPersonas(@Query('dispositivoId') dispositivoId?: string) {
    return this.controlAccesoService.findAllPersonas({ dispositivoId });
  }

  @Post('personas')
  @ApiOperation({ summary: 'Crear o actualizar una persona de control de acceso' })
  async createPersona(@Body() body: CreatePersonaAccesoDto) {
    return this.controlAccesoService.createPersona(body);
  }

  @Post('personas/:id')
  @ApiOperation({ summary: 'Actualizar campos específicos de una persona (ej: activo)' })
  async updatePersona(@Param('id') id: string, @Body() body: any) {
    return this.controlAccesoService.updatePersona(id, body);
  }

  @Post('sync-hardware')
  @ApiOperation({ summary: 'Extrae usuarios y rostros directamente del hardware' })
  async syncHardware(@Body() body: { ip?: string; deviceId?: string; includePhotos?: boolean }) {
    this.logger.log(`[SYNC] Extrayendo datos del hardware ${body.deviceId || body.ip || 'sin destino'}`);
    return this.controlAccesoService.syncUsuariosHardware(body);
  }

  @Post('dispositivos/:id/sincronizar-personas')
  @ApiOperation({ summary: 'Sincroniza personas y rostros de un dispositivo registrado' })
  async syncHardwareDevice(@Param('id') id: string, @Body() body: { includePhotos?: boolean }) {
    this.logger.log(`🔄 [SYNC] Extrayendo personas del dispositivo ${id}`);
    return this.controlAccesoService.syncUsuariosHardware({ deviceId: id, includePhotos: body?.includePhotos });
  }

  @Post('subir-rostro')
  @ApiOperation({ summary: 'Sincroniza foto de rostro al hardware' })
  async subirRostro(@Body() body: { ip: string, userId: string, faceBase64: string, deviceId?: string }) {
    this.logger.log(`👤 [ROSTRO] Subiendo cara para el usuario ${body.userId} en ${body.ip}`);
    return this.controlAccesoService.uploadRostro(body.ip, body.userId, body.faceBase64, body.deviceId);
  }

  @Post('personas/:personaId/push-to-device/:dispositivoId')
  @ApiOperation({ summary: 'Sincroniza una persona específica a un dispositivo específico' })
  async pushPersonaToDevice(@Param('personaId') personaId: string, @Param('dispositivoId') dispositivoId: string) {
    this.logger.log(`👤 [SYNC-PERSON] Pushing person ${personaId} to device ${dispositivoId}`);
    return this.controlAccesoService.pushPersonaToDevice(personaId, dispositivoId);
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
  async getSnapshot(@Query('ip') ip: string, @Query('id') id: string, @Res() res: Response) {
    try {
      const buffer = await this.controlAccesoService.getSnapshot(ip || '192.168.1.117', id || undefined);
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

  @Get('webrtc-stream/:id')
  @ApiOperation({ summary: 'Inicia el streaming WebRTC (MediaMTX) para un dispositivo IoT' })
  async startWebRTCStream(@Param('id') id: string) {
    this.logger.log(`🎥 [WEBRTC] Solicitando stream WebRTC para dispositivo: ${id}`);
    return this.controlAccesoService.startVideoStream(id);
  }

  @Public()
  @Get('debug-intercom/:id')
  @ApiOperation({ summary: 'Queries intercom configuration and status' })
  async debugIntercom(@Param('id') id: string) {
    this.logger.log(`🔍 [DEBUG-INTERCOM] Querying call config for device: ${id}`);
    return this.controlAccesoService.debugIntercomDevice(id);
  }

  @Public()
  @Get('diag-san-felipe')
  @ApiOperation({ summary: 'Diagnósticos de conectividad del túnel de San Felipe (10.30.30.2)' })
  async diagSanFelipe() {
    const results: any = {};
    const ip = '10.30.30.2';
    const port = 10118;
    const user = 'admin';
    const pass = 'proliseg1015';

    results.localTime = new Date().toISOString();

    // 1. Ping test to router
    try {
      const { execSync } = require('child_process');
      results.pingRouter = execSync('ping -c 3 10.30.30.2 || ping -n 3 10.30.30.2', { timeout: 5000 }).toString();
    } catch (e) {
      results.pingRouter = 'Ping failed: ' + e.message;
    }

    // 2. HTTP test direct to device
    try {
      const axios = require('axios');
      const response = await axios.get(`http://10.30.30.2:10118/ISAPI/System/deviceInfo`, { timeout: 5000 });
      results.deviceInfoDirect = 'Success direct: ' + String(response.data || '').substring(0, 300);
    } catch (e) {
      results.deviceInfoDirect = 'HTTP direct failed: ' + e.message;
    }

    // 3. Proxy Request test
    try {
      const devInfo = await this.controlAccesoService.proxyRequestDynamic(
        ip,
        'get',
        '/ISAPI/System/deviceInfo',
        null,
        { customTimeout: 5000, deviceId: '46ffd059-f888-4e2c-94cb-4ae62b2f7251' }
      );
      results.proxyRequest = devInfo;
    } catch (e) {
      results.proxyRequest = 'Proxy request failed: ' + e.message;
    }

    // 4. San Felipe Router REST API test
    try {
      const axios = require('axios');
      const httpsAgent = new (require('https').Agent)({ rejectUnauthorized: false });
      const resp = await axios.get(`http://10.30.30.2/rest/ip/firewall/nat`, {
        auth: { username: 'admin', password: 'proliseg1015' },
        httpsAgent,
        timeout: 5000
      });
      results.mikrotikNat = resp.data;
    } catch (e) {
      results.mikrotikNat = 'MikroTik REST failed: ' + e.message;
    }

    // 5. User Search test
    try {
      const body = {
        UserInfoSearchCond: {
          searchID: `diag_${Date.now()}`,
          searchResultPosition: 0,
          maxResults: 10,
        },
      };
      const searchRes = await this.controlAccesoService.proxyRequestDynamic(
        ip,
        'post',
        '/ISAPI/AccessControl/UserInfo/Search?format=json',
        body,
        { customTimeout: 5000, deviceId: '46ffd059-f888-4e2c-94cb-4ae62b2f7251' }
      );
      results.searchUsers = searchRes;
    } catch (e) {
      results.searchUsers = 'Search failed: ' + e.message;
    }

    // 6. Test User Creation
    try {
      const createRes = await this.controlAccesoService.crearUsuarioEnHardware(
        ip,
        '999999',
        'TEST SAN FELIPE'
      );
      results.createUser = createRes;

      // Test face download and upload
      try {
        const testFaceUrl = 'https://ttkubmwrwgqxjdafpgji.supabase.co/storage/v1/object/public/control-acceso-faces/personas/395923e2-2692-42a0-b1c9-2fd9cd72ce80/1781276240820.jpg';
        const response = await axios.get(testFaceUrl, { responseType: 'arraybuffer', timeout: 10000 });
        const base64Photo = Buffer.from(response.data).toString('base64');
        results.downloadPhoto = `Success, size: ${base64Photo.length} chars`;

        try {
          const uploadRes = await this.controlAccesoService.uploadRostro(
            ip,
            '999999',
            base64Photo,
            '46ffd059-f888-4e2c-94cb-4ae62b2f7251'
          );
          results.uploadFace = uploadRes;
        } catch (uploadErr) {
          results.uploadFace = 'Upload failed: ' + uploadErr.message;
          if (uploadErr.response && uploadErr.response.data) {
            results.uploadFaceDetail = typeof uploadErr.response.data === 'object' ? JSON.stringify(uploadErr.response.data) : String(uploadErr.response.data);
          }
        }
      } catch (dlErr) {
        results.downloadPhoto = 'Download failed: ' + dlErr.message;
      }

      // Clean up right away
      try {
        await this.controlAccesoService.proxyRequestDynamic(
          ip,
          'put',
          '/ISAPI/AccessControl/UserInfo/Delete?format=json',
          {
            UserInfoDelCond: {
              EmployeeNoList: [{ employeeNo: '999999' }]
            }
          },
          { customTimeout: 5000, deviceId: '46ffd059-f888-4e2c-94cb-4ae62b2f7251' }
        );
        results.cleanupUser = 'Success';
      } catch (cleanErr) {
        results.cleanupUser = 'Failed: ' + cleanErr.message;
      }
    } catch (e) {
      results.createUser = 'Create failed: ' + e.message;
      if (e.response && e.response.data) {
        results.createUserDetail = typeof e.response.data === 'object' ? JSON.stringify(e.response.data) : String(e.response.data);
      }
    }

    return results;
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
      fecha_vigencia?: string;
    }
  ) {
    return this.controlAccesoService.createLugarRecopilacion(body);
  }

  @Put('recopilacion/lugares/:id')
  @ApiOperation({ summary: 'Actualiza lugar y link de recopilacion de datos' })
  async updateLugarRecopilacion(
    @Param('id') id: string,
    @Body() body: {
      nombre_lugar: string;
      descripcion?: string;
      requiere_torre?: boolean;
      codigo_seguridad?: string;
      fecha_vigencia?: string;
    }
  ) {
    return this.controlAccesoService.updateLugarRecopilacion(Number(id), body);
  }

  @Delete('recopilacion/lugares/:id')
  @ApiOperation({ summary: 'Elimina un lugar y su link de recopilacion' })
  async deleteLugarRecopilacion(@Param('id') id: string) {
    return this.controlAccesoService.deleteLugarRecopilacion(Number(id));
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

  // ─── WEBHOOKS — Las cámaras mandan aquí sus eventos automáticamente ───────

  /**
   * Hikvision manda un POST aquí cada vez que alguien pasa su tarjeta/cara.
   * La cámara ya fue configurada para apuntar a esta URL al arrancar el backend.
   */
  @Public()
  @Post('webhook/evento/hik/:dispositivoId')
  @ApiOperation({ summary: '[WEBHOOK] Receptor de eventos push de cámaras Hikvision' })
  async webhookHikvision(@Param('dispositivoId') dispositivoId: string, @Body() body: any) {
    this.logger.log(`📥 [Webhook HIK] Evento recibido de dispositivo ${dispositivoId}`);
    return this.devicePoller.procesarWebhookHikvision(body, dispositivoId);
  }

  /**
   * Dahua manda un POST aquí cada vez que hay un evento de acceso.
   */
  @Public()
  @Post('webhook/evento/dahua/:dispositivoId')
  @ApiOperation({ summary: '[WEBHOOK] Receptor de eventos push de cámaras Dahua' })
  async webhookDahua(@Param('dispositivoId') dispositivoId: string, @Body() body: any) {
    this.logger.log(`📥 [Webhook DH] Evento recibido de dispositivo ${dispositivoId}`);
    return this.devicePoller.procesarWebhookDahua(body, dispositivoId);
  }

  // ─── HISTORIAL DE EVENTOS ─────────────────────────────────────────────────

  @Get('eventos/historial')
  @ApiOperation({ summary: 'Obtiene el historial de eventos de acceso con filtros opcionales' })
  async getEventosHistorial(
    @Query('dispositivoId') dispositivoId?: string,
    @Query('limit') limit?: string,
    @Query('desde') desde?: string,
  ) {
    return this.controlAccesoService.getEventosHistorial({
      dispositivoId,
      limit: limit ? Number(limit) : 50,
      desde,
    });
  }

  @Get('logs')
  @ApiOperation({ summary: 'Alias del historial de eventos VMS' })
  async getLogs(
    @Query('dispositivoId') dispositivoId?: string,
    @Query('limit') limit?: string,
    @Query('desde') desde?: string,
  ) {
    return this.controlAccesoService.getEventosHistorial({
      dispositivoId,
      limit: limit ? Number(limit) : 50,
      desde,
    });
  }

  @Post('recopilacion/sync-registro')
  @ApiOperation({ summary: 'Sincronizar registro recopilado y crear cuenta de residente' })
  async syncRecopilacion(
    @Body() body: { registroId: number; dispositivoIds: string[] }
  ) {
    if (!body.registroId) {
      throw new BadRequestException('registroId es obligatorio');
    }
    return this.controlAccesoService.syncRecopilacionRegistro(
      body.registroId,
      body.dispositivoIds || []
    );
  }

  @Post('recopilacion/sync-registros')
  @ApiOperation({ summary: 'Sincronizar múltiples registros recopilados y crear cuentas de residente' })
  async syncRecopilaciones(
    @Body() body: { registroIds: number[]; dispositivoIds: string[] }
  ) {
    if (!body.registroIds || !Array.isArray(body.registroIds) || body.registroIds.length === 0) {
      throw new BadRequestException('registroIds es obligatorio y debe ser un arreglo');
    }
    return this.controlAccesoService.syncRecopilacionRegistros(
      body.registroIds,
      body.dispositivoIds || []
    );
  }

  @Delete('personas/:id')
  @ApiOperation({ summary: 'Eliminar una persona de la base de datos y de los dispositivos vinculados' })
  async deletePersona(@Param('id') id: string) {
    return this.controlAccesoService.deletePersona(id);
  }

  // ─────────────────────────────────────────────────────────────────
  // VISITAS
  // ─────────────────────────────────────────────────────────────────

  @Get('visitas')
  @ApiOperation({ summary: 'Listar visitas programadas' })
  async getVisitas(@Query('estado') estado?: string, @Query('dispositivo_id') dispositivo_id?: string, @Query('limit') limit?: string) {
    return this.controlAccesoService.getVisitas({ estado, dispositivo_id, limit: limit ? parseInt(limit) : undefined });
  }

  @Post('visitas')
  @ApiOperation({ summary: 'Crear nueva visita y generar QR' })
  async createVisita(@Body() body: any, @CurrentUser() user?: any) {
    const operador = user || {};
    body.operador_nombre = body.operador_nombre || operador.nombre_completo || 'Operador';
    body.operador_id = body.operador_id || String(operador.id || '');
    return this.controlAccesoService.createVisita(body);
  }

  @Put('visitas/:id')
  @ApiOperation({ summary: 'Editar o reprogramar una visita' })
  async updateVisita(@Param('id') id: string, @Body() body: any) {
    return this.controlAccesoService.updateVisita(id, body);
  }

  @Delete('visitas/:id')
  @ApiOperation({ summary: 'Cancelar una visita' })
  async cancelarVisita(@Param('id') id: string) {
    return this.controlAccesoService.cancelarVisita(id);
  }

  @Get('visitas/validar-qr/:token')
  @Public()
  @ApiOperation({ summary: 'Validar token QR de visita y registrar ingreso' })
  async validarQrVisita(@Param('token') token: string) {
    return this.controlAccesoService.validarQrVisita(token);
  }

  @Post('visitas/:id/registrar-egreso')
  @ApiOperation({ summary: 'Registrar egreso del visitante' })
  async registrarEgresoVisita(@Param('id') id: string) {
    return this.controlAccesoService.registrarEgresoVisita(id);
  }
}
