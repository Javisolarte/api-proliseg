import {
  Controller,
  Post,
  Body,
  UseGuards,
  BadRequestException,
  Req,
  Logger,
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

  constructor(private readonly iaService: IaService) {}

  @Post('query')
  @ApiOperation({
    summary: 'Procesar consulta con IA y ejecutar SQL (solo SELECT)',
  })
  @ApiBody({ type: IaDto })
  @ApiResponse({ status: 200, description: 'Consulta procesada correctamente' })
  @ApiResponse({ status: 400, description: 'Consulta inválida' })
  async handleQuery(
    @Body() body: IaDto,
    @CurrentUser() user: any,
    @Req() req: any, // ✅ sin tipado "Request" para evitar el warning
  ) {
    this.logger.debug(`📥 [IAController] Body recibido: ${JSON.stringify(body)}`);
    this.logger.debug(`🧠 [IAController] Usuario autenticado: ${user?.email || 'Desconocido'}`);

    const { query } = body;

    if (!query || typeof query !== 'string') {
      this.logger.warn(`⚠️ [IAController] Campo "query" inválido o vacío: ${query}`);
      throw new BadRequestException('Debe enviar una consulta válida en el campo "query".');
    }

    // ✅ Obtener token desde el usuario o los headers
    const token =
      user?.token ||
      user?.access_token ||
      req.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      this.logger.error('🚫 [IAController] No se encontró el token del usuario autenticado.');
      throw new BadRequestException('No se encontró el token del usuario autenticado.');
    }

    this.logger.debug(`✅ [IAController] Query recibido correctamente: ${query}`);
    this.logger.debug(`🪪 [IAController] Token detectado: ${token ? 'Sí' : 'No'}`);

    const response = await this.iaService.processQuery(query, token);

    this.logger.debug(`📤 [IAController] Respuesta del servicio IA: ${JSON.stringify(response)}`);
    return response;
  }
}
