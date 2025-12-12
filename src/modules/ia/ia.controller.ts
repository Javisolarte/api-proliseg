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

@ApiTags('IA')
@Controller('ia')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth('JWT-auth')
export class IaController {
  private readonly logger = new Logger(IaController.name);

  constructor(private readonly iaService: IaService) { }

  // ============================================================
  // 🔹 1. CONSULTAS IA SQL
  // ============================================================
  @Post('query')
  @ApiOperation({
    summary: 'Procesar consulta con IA y ejecutar SQL (solo SELECT)',
    description:
      'Convierte una consulta en lenguaje natural en SQL, ejecuta el resultado y devuelve una respuesta humanizada.',
  })
  @ApiBody({ type: IaDto })
  @ApiResponse({
    status: 200,
    description: 'Consulta procesada correctamente',
    schema: {
      example: {
        ok: true,
        sql: 'SELECT * FROM empleados WHERE estado = "activo"',
        data: [{ id: 1, nombre: 'Carlos Pérez' }],
        message: 'Actualmente hay 25 empleados activos en el sistema.',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Consulta inválida' })
  async handleQuery(
    @Body() body: IaDto,
    @CurrentUser() user: any,
    @Req() req: any,
  ) {
    this.logger.debug(`📥 [IAController] Body recibido: ${JSON.stringify(body)}`);
    this.logger.debug(`🧠 [IAController] Usuario autenticado: ${user?.email || 'Desconocido'}`);

    const { query } = body;

    if (!query || typeof query !== 'string') {
      this.logger.warn(`⚠️ [IAController] Campo "query" inválido o vacío: ${query}`);
      throw new BadRequestException('Debe enviar una consulta válida en el campo "query".');
    }

    const token =
      user?.token ||
      user?.access_token ||
      req.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      this.logger.error('🚫 [IAController] No se encontró el token del usuario autenticado.');
      throw new BadRequestException('No se encontró el token del usuario autenticado.');
    }

    // Asegurar que el token esté en el objeto user
    user.token = token;

    this.logger.debug(`✅ [IAController] Query recibido correctamente: ${query}`);
    this.logger.debug(`👤 [IAController] Rol del usuario: ${user?.rol}`);

    // Pasar el objeto user completo en lugar de solo el token
    const response = await this.iaService.processQuery(query, user);

    this.logger.debug(`📤 [IAController] Respuesta del servicio IA: ${JSON.stringify(response)}`);
    return response;
  }

  // ============================================================
  // 🔹 2. IA PREDICCIÓN DE AUSENCIAS E INCIDENTES
  // ============================================================
  @Get('predicciones')
  @ApiOperation({
    summary: 'Predice ausencias, retrasos e incidentes del personal',
    description:
      'Analiza el historial de asistencia y genera predicciones de posibles ausencias o incidentes.',
  })
  @ApiResponse({
    status: 200,
    description: 'Predicciones generadas correctamente',
    schema: {
      example: {
        ok: true,
        predicciones: [
          {
            empleado: 'Juan López',
            riesgoAusencia: 0.83,
            riesgoRetraso: 0.61,
            comentarios: 'Ha presentado 3 ausencias este mes.',
          },
        ],
      },
    },
  })
  async getPredicciones(@CurrentUser() user: any) {
    this.logger.log(`🔮 Generando predicciones de ausencias/incidentes para ${user.email}`);
    return this.iaService.generarPredicciones(user);
  }

  // ============================================================
  // 🔹 3. IA SUPERVISOR AUTOMÁTICO
  // ============================================================
  @Get('supervisor')
  @ApiOperation({
    summary: 'IA Supervisor — analiza comportamiento del personal en tiempo real',
    description:
      'Supervisa en tiempo real los patrones de asistencia, actividad y alertas del personal.',
  })
  @ApiResponse({
    status: 200,
    description: 'Supervisión generada correctamente',
    schema: {
      example: {
        ok: true,
        alertas: [
          { tipo: 'Retraso', empleado: 'Ana Torres', hora: '07:35', turno: 'Mañana' },
        ],
        resumen: 'Se detectaron 2 retrasos y 1 ausencia no justificada.',
      },
    },
  })
  async getSupervisor(@CurrentUser() user: any) {
    this.logger.log(`🧠 IA Supervisor ejecutando monitoreo en tiempo real para ${user.email}`);
    return this.iaService.ejecutarSupervisorIA(user);
  }

  // ============================================================
  // 🔹 4. IA DE REENTRENAMIENTO ADAPTATIVO
  // ============================================================
  @Post('reentrenamiento')
  @ApiOperation({
    summary: 'IA Reentrenamiento — ajusta patrones de comportamiento según datos recientes',
    description:
      'Permite recalibrar el modelo de IA en función de datos de desempeño y cambios de personal.',
  })
  @ApiResponse({
    status: 200,
    description: 'Modelo de IA actualizado correctamente',
    schema: {
      example: {
        ok: true,
        message: 'Modelo reentrenado exitosamente con 300 registros recientes.',
      },
    },
  })
  async reentrenarModelo(@Body() body: any, @CurrentUser() user: any) {
    this.logger.log(`⚙️ Iniciando reentrenamiento IA para ${user.email}`);
    return this.iaService.reentrenarModelo(body, user);
  }

  // ============================================================
  // 🔹 5. RUTAS INTELIGENTES DE PATRULLAJE
  // ============================================================
  @Post('rutas-inteligentes')
  @ApiOperation({
    summary: 'Genera rutas de patrullaje óptimas basadas en IA y ubicaciones GPS',
    description:
      'Usa IA geoespacial para generar rutas eficientes considerando distancias, prioridades y zonas de riesgo.',
  })
  @ApiBody({
    schema: {
      example: {
        puntos: [
          { lat: 5.6921, lng: -72.9403 },
          { lat: 5.6915, lng: -72.9431 },
          { lat: 5.6908, lng: -72.9465 },
        ],
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Ruta óptima generada correctamente',
    schema: {
      example: {
        ok: true,
        rutaOptima: [
          { lat: 5.6915, lng: -72.9431 },
          { lat: 5.6908, lng: -72.9465 },
          { lat: 5.6921, lng: -72.9403 },
        ],
        distanciaTotal: '1.3 km',
        tiempoEstimado: '6 min',
      },
    },
  })
  async generarRuta(@Body() body: any, @CurrentUser() user: any) {
    this.logger.log(`🗺️ Generando rutas inteligentes para ${user.email}`);
    return this.iaService.generarRutasOptimas(body, user);
  }

  // ============================================================
  // 🔹 6. DETECCIÓN DE COMPORTAMIENTO ANÓMALO
  // ============================================================
  @Get('anomalos')
  @ApiOperation({
    summary: 'Detecta comportamientos anómalos en cámaras o sensores (IA Visión)',
    description:
      'Usa modelos de visión computacional y análisis de patrones para identificar comportamientos extraños.',
  })
  @ApiResponse({
    status: 200,
    description: 'Comportamientos anómalos detectados',
    schema: {
      example: {
        ok: true,
        anomalías: [
          { tipo: 'Movimiento inesperado', zona: 'Bodega 3', hora: '02:14 AM' },
        ],
      },
    },
  })
  async detectarAnomalias(@CurrentUser() user: any) {
    this.logger.log(`📹 Analizando video/sensores para ${user.email}`);
    return this.iaService.detectarComportamientoAnomalo(user);
  }

  // ============================================================
  // 🔹 7. ESTADO DE API KEYS DE GEMINI
  // ============================================================
  @Get('api-keys-status')
  @ApiOperation({
    summary: 'Consulta el estado de las API keys de Gemini',
    description:
      'Muestra cuántas peticiones quedan disponibles en cada API key y cuál está actualmente en uso.',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado de las API keys obtenido correctamente',
    schema: {
      example: {
        ok: true,
        totalKeys: 5,
        currentKeyIndex: 2,
        keys: [
          {
            keyNumber: 1,
            requestCount: 25,
            remaining: 0,
            isBlocked: true,
            lastError: 'Límite de peticiones alcanzado',
            lastResetTime: '2025-12-12T10:00:00.000Z',
          },
          {
            keyNumber: 2,
            requestCount: 15,
            remaining: 10,
            isBlocked: false,
            lastError: null,
            lastResetTime: '2025-12-12T10:00:00.000Z',
          },
        ],
      },
    },
  })
  async getApiKeysStatus() {
    this.logger.log('📊 Consultando estado de API keys de Gemini');
    return {
      ok: true,
      ...this.iaService.getGeminiApiKeysStatus(),
    };
  }
}
