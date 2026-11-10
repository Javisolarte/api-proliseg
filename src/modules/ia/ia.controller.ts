import {
  Controller,
  Post,
  Body,
  UseGuards,
  BadRequestException,
  Req,
  Logger,
  Get,
} from '@nestjs/common';
import { IaService } from './ia.service';
import { CatorceSentinelService } from './catorce-sentinel.service';
import { CatorceBrainService } from './catorce-brain.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { IaDto } from './dto/ia.dto';

@ApiTags('IA - CATORCE & Segundo Cerebro PROLISEG LTDA')
@Controller('ia')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth('JWT-auth')
export class IaController {
  private readonly logger = new Logger(IaController.name);

  constructor(
    private readonly iaService: IaService,
    private readonly catorceSentinel: CatorceSentinelService,
    private readonly catorceBrain: CatorceBrainService,
  ) {}

  // ============================================================
  // 🔹 1. CONSULTAS Y COMANDOS OMNISCIENTES A CATORCE IA
  // ============================================================
  @Post('query')
  @ApiOperation({
    summary: 'Procesar consulta o comando autónomo con CATORCE IA (Segundo Cerebro PROLISEG LTDA)',
    description:
      'Orquesta consultas en vivo (Puestos, Empleados, Vacaciones, Clientes, Contratos, Controles de Acceso), memoria vectorial ia_brain y acciones autónomas (crear minutas/novedades).',
  })
  @ApiBody({ type: IaDto })
  async handleQuery(
    @Body() body: any,
    @CurrentUser() user: any,
    @Req() req: any,
  ) {
    const query = typeof body === 'string' ? body : body?.query;
    const canal = body?.canal || 'texto';

    if (!query || typeof query !== 'string') {
      throw new BadRequestException('Debe enviar una consulta válida en el campo "query".');
    }

    const token =
      user?.token ||
      user?.access_token ||
      req.headers?.authorization?.replace('Bearer ', '');

    if (user && token) {
      user.token = token;
    }

    const effectiveUser = user?.user || user || {};
    if (token) {
      effectiveUser.token = token;
    }
    if (body?.userContext && typeof body.userContext === 'object') {
      Object.assign(effectiveUser, body.userContext);
    }
    const conversationHistory = Array.isArray(body?.conversationHistory) ? body.conversationHistory : undefined;
    return this.iaService.processQuery(query, effectiveUser, canal, conversationHistory);
  }

  // ============================================================
  // 🔹 2. TELEMETRÍA EN VIVO DEL SEGUNDO CEREBRO CATORCE
  // ============================================================
  @Get('catorce/telemetry')
  @ApiOperation({
    summary: 'Obtiene toda la telemetría en tiempo real de Prolicontrol y del Segundo Cerebro ia_brain',
  })
  async getCatorceTelemetry(@CurrentUser() user: any) {
    return this.iaService.getCatorceTelemetry(user);
  }

  // ============================================================
  // 🔹 2.1 TELEMETRIA Y DIAGNOSTICO EN TIEMPO REAL DE LA VPS
  // ============================================================
  @Get('catorce/vps-status')
  @ApiOperation({
    summary: 'Diagnóstico en tiempo real de la VPS: Disco, RAM, CPU, PostgreSQL y Segundo Cerebro',
  })
  async getVpsStatus(@CurrentUser() user: any) {
    return this.iaService.getSystemAndVpsStatus(user);
  }

  // ============================================================
  // 🔹 2.2 TEST DE DISPOSITIVOS Y HARDWARE IoT EN CONSOLA (SOCKETS TCP)
  // ============================================================
  @Post('catorce/device-test')
  @ApiOperation({
    summary: 'Ejecuta prueba de sockets TCP en consola para hardware IoT (Dahua, Hikvision, MikroTik)',
  })
  async testDevices(@Body() body: { target?: string; port?: number }, @CurrentUser() user: any) {
    return this.iaService.testDeviceConnectivity(body?.target, body?.port, user);
  }

  // ============================================================
  // 🔹 2.3 CREACION INTEGRAL DE PUESTOS DE TRABAJO
  // ============================================================
  @Post('catorce/puesto-completo')
  @ApiOperation({
    summary: 'Crea un puesto de trabajo completo con validación de cliente, contrato y subpuesto',
  })
  async crearPuesto(@Body() body: any, @CurrentUser() user: any) {
    return this.iaService.crearPuestoCompleto(body, user);
  }

  // ============================================================
  // 🔹 2.4 GESTION Y PROGRAMACION DE TURNOS / HORARIOS
  // ============================================================
  @Post('catorce/gestion-turnos')
  @ApiOperation({
    summary: 'Gestiona turnos, asignaciones y programación de guardas con validación de horarios',
  })
  async gestionarTurnos(@Body() body: any, @CurrentUser() user: any) {
    return this.iaService.gestionarTurnosYHorarios(body, user);
  }

  // ============================================================
  // 🔹 3. CONFIGURACIÓN DE GEMINI LIVE API (VOZ EN TIEMPO REAL)
  // ============================================================
  @Get('catorce/live-session')
  @ApiOperation({
    summary: 'Entrega la configuración de conexión WebSocket para Gemini Multimodal Live API',
  })
  async getLiveSessionConfig(@CurrentUser() user: any) {
    return this.iaService.getLiveSessionConfig(user);
  }

  @Post('catorce/live-api-key')
  @ApiOperation({
    summary: 'Configura o actualiza en caliente la API Key de Gemini Live API ($20 USD crédito)',
  })
  async setLiveApiKey(@Body() body: { apiKey: string }) {
    if (!body?.apiKey) {
      throw new BadRequestException('Debe proporcionar apiKey.');
    }
    return this.iaService.setLiveApiKey(body.apiKey);
  }

  // ============================================================
  // 🔹 4. INGESTA COLABORATIVA AL SEGUNDO CEREBRO PROLISEG LTDA
  // ============================================================
  @Post('catorce/brain/knowledge')
  @ApiOperation({
    summary: 'Agrega nuevo conocimiento al Segundo Cerebro de PROLISEG LTDA (ia_brain + Markdown)',
  })
  async addBrainKnowledge(@Body() body: any, @CurrentUser() user: any) {
    return this.iaService.addBrainKnowledge(body, user);
  }

  // ============================================================
  // 🔹 5. EJECUCIÓN DE ACCIONES AUTÓNOMAS AUDITABLES (MINUTAS, PUERTAS)
  // ============================================================
  @Post('catorce/action')
  @ApiOperation({
    summary: 'Ejecuta una acción autónoma auditable de CATORCE (ej. crear minuta de radio-operación, auditar puertas)',
  })
  async executeAutonomousAction(@Body() body: any, @CurrentUser() user: any) {
    return this.iaService.executeAutonomousAction(body, user);
  }

  @Post('catorce/tts')
  @ApiOperation({
    summary: 'Sintetiza voz ultra-humanizada nativa de Gemini 2.5 Audio (24kHz WAV) para CATORCE',
  })
  async synthesizeCatorceVoice(@Body() body: { text: string; voiceName?: string }) {
    if (!body?.text) {
      throw new BadRequestException('Debe enviar el campo "text".');
    }
    return this.iaService.synthesizeHumanVoice(body.text, body.voiceName || 'Aoede');
  }

  // ============================================================
  // 🔹 6. IA PREDICCIÓN DE AUSENCIAS E INCIDENTES
  // ============================================================
  @Get('predicciones')
  @ApiOperation({
    summary: 'Predice ausencias, retrasos e incidentes del personal',
  })
  async getPredicciones(@CurrentUser() user: any) {
    return this.iaService.generarPredicciones(user);
  }

  // ============================================================
  // 🔹 7. IA SUPERVISOR AUTOMÁTICO
  // ============================================================
  @Get('supervisor')
  @ApiOperation({
    summary: 'IA Supervisor — analiza comportamiento del personal en tiempo real',
  })
  async getSupervisor(@CurrentUser() user: any) {
    return this.iaService.ejecutarSupervisorIA(user);
  }

  // ============================================================
  // 🔹 8. IA DE REENTRENAMIENTO ADAPTATIVO
  // ============================================================
  @Post('reentrenamiento')
  @ApiOperation({
    summary: 'IA Reentrenamiento — ajusta patrones de comportamiento según datos recientes',
  })
  async reentrenarModelo(@Body() body: any, @CurrentUser() user: any) {
    return this.iaService.reentrenarModelo(body, user);
  }

  // ============================================================
  // 🔹 9. RUTAS INTELIGENTES DE PATRULLAJE
  // ============================================================
  @Post('rutas-inteligentes')
  @ApiOperation({
    summary: 'Genera rutas de patrullaje óptimas basadas en IA y ubicaciones GPS',
  })
  async generarRuta(@Body() body: any, @CurrentUser() user: any) {
    return this.iaService.generarRutasOptimas(body, user);
  }

  // ============================================================
  // 🔹 10. DETECCIÓN DE COMPORTAMIENTO ANÓMALO
  // ============================================================
  @Get('anomalos')
  @ApiOperation({
    summary: 'Detecta comportamientos anómalos en cámaras o sensores (IA Visión)',
  })
  async detectarAnomalias(@CurrentUser() user: any) {
    return this.iaService.detectarComportamientoAnomalo(user);
  }

  // ============================================================
  // 🔹 11. SUGERENCIAS DE CANDIDATOS (TURNOS)
  // ============================================================
  @Post('sugerir-candidatos')
  @ApiOperation({
    summary: 'Sugerir candidatos para un turno o asignación',
  })
  async sugerirCandidatos(@Body() body: any, @CurrentUser() user: any) {
    return this.iaService.sugerirEmpleados(body);
  }

  // ============================================================
  // 🔹 12. ESTADO DE API KEYS DE GEMINI
  // ============================================================
  @Get('api-keys-status')
  @ApiOperation({
    summary: 'Consulta el estado de las API keys de Gemini',
  })
  async getApiKeysStatus() {
    return {
      ok: true,
      ...this.iaService.getGeminiApiKeysStatus(),
    };
  }

  // ============================================================
  // 🔹 13. ALERTAS PROACTIVAS DEL CENTINELA CATORCE
  // ============================================================
  @Get('catorce/proactive-alerts')
  @ApiOperation({
    summary: 'Obtiene las alertas proactivas detectadas por el Centinela en segundo plano',
  })
  async getProactiveAlerts() {
    const alerts = await this.catorceSentinel.getUnresolvedAlerts();
    return { ok: true, alerts };
  }

  @Post('catorce/proactive-alerts/:id/ack')
  @ApiOperation({
    summary: 'Reconoce una alerta proactiva',
  })
  async acknowledgeAlert(@Req() req: any, @CurrentUser() user: any) {
    const id = Number(req.params.id);
    const success = await this.catorceSentinel.acknowledgeAlert(id, user);
    return { ok: success };
  }

  // ============================================================
  // 🔹 14. GESTIÓN DE MEMORIA DE TRABAJO (SCRATCHPAD)
  // ============================================================
  @Post('catorce/working-memory/clear')
  @ApiOperation({
    summary: 'Limpia la memoria de trabajo activa del usuario actual',
  })
  async clearWorkingMemory(@CurrentUser() user: any) {
    await this.catorceBrain.clearWorkingMemory(user);
    return { ok: true, message: 'Memoria de trabajo limpiada exitosamente.' };
  }
}
