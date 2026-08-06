import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EncuestasService } from './encuestas.service';
import { CreateEncuestaDto, UpdateEncuestaDto, SubmitRespuestaDto } from './dto/encuesta.dto';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Encuestas')
@Controller()
export class EncuestasController {
  constructor(private readonly encuestasService: EncuestasService) {}

  // 🔒 PROTECTED ENDPOINTS (ADMINISTRACIÓN)

  @Get('encuestas')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar todas las encuestas con métricas' })
  async findAll(@Query('tipo') tipo?: string, @Query('estado') estado?: string) {
    return this.encuestasService.findAll({ tipo, estado });
  }

  @Get('encuestas/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener detalle de encuesta con sus preguntas' })
  async findOne(@Param('id') id: string) {
    return this.encuestasService.findOne(parseInt(id, 10));
  }

  @Get('encuestas/:id/reporte')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener reporte estadístico y plan de acción de clima laboral' })
  async getReporte(@Param('id') id: string) {
    return this.encuestasService.getReporte(parseInt(id, 10));
  }

  @Post('encuestas')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear nueva encuesta' })
  async create(@Body() createDto: CreateEncuestaDto, @Req() req: any) {
    const usuarioId = req.user?.id || req.user?.sub;
    return this.encuestasService.create(createDto, usuarioId);
  }

  @Put('encuestas/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar encuesta existente' })
  async update(@Param('id') id: string, @Body() updateDto: UpdateEncuestaDto) {
    return this.encuestasService.update(parseInt(id, 10), updateDto);
  }

  @Delete('encuestas/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Eliminar encuesta' })
  async remove(@Param('id') id: string) {
    return this.encuestasService.remove(parseInt(id, 10));
  }

  // 🌐 PUBLIC ENDPOINTS (SIN LOGIN PARA PERSONAL / LINK PÚBLICO)

  @Get('public/encuestas/:token')
  @Public()
  @ApiOperation({ summary: 'Obtener encuesta pública por token (Sin login)' })
  async getEncuestaPublica(@Param('token') token: string) {
    return this.encuestasService.findByToken(token);
  }

  @Post('public/encuestas/:token/responder')
  @Public()
  @ApiOperation({ summary: 'Responder encuesta pública con aviso de privacidad y tratamiento de datos' })
  async submitRespuestaPublica(
    @Param('token') token: string,
    @Body() submitDto: SubmitRespuestaDto
  ) {
    return this.encuestasService.submitRespuesta(token, submitDto);
  }
}
