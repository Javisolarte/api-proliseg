import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AsistenciaIotService } from './asistencia-iot.service';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  UpdatePuestoIotConfigDto,
  CreateHorarioDto,
  CreateEnlaceDto,
  RegistroPublicoPersonalDto,
  CreatePersonalManualDto,
  ProcesarMarcacionManualDto,
} from './dto/asistencia-iot.dto';

@ApiTags('Asistencias IoT (Clientes / Puestos)')
@Controller('asistencia-iot')
export class AsistenciaIotController {
  constructor(private readonly service: AsistenciaIotService) {}

  // ==========================================================================
  // PUESTOS & CONFIGURACIÓN
  // ==========================================================================

  @Get('puestos')
  @ApiOperation({ summary: 'Listado de puestos con estado de Asistencia IoT' })
  getPuestosList() {
    return this.service.getPuestosList();
  }

  @Get('puestos/:puestoId/config')
  @ApiOperation({ summary: 'Obtener configuración IoT del puesto' })
  getPuestoConfig(@Param('puestoId', ParseIntPipe) puestoId: number) {
    return this.service.getPuestoConfig(puestoId);
  }

  @Put('puestos/:puestoId/config')
  @ApiOperation({ summary: 'Actualizar configuración IoT del puesto' })
  updatePuestoConfig(
    @Param('puestoId', ParseIntPipe) puestoId: number,
    @Body() dto: UpdatePuestoIotConfigDto,
  ) {
    return this.service.updatePuestoConfig(puestoId, dto);
  }

  @Get('dispositivos')
  @ApiOperation({ summary: 'Listado de dispositivos IoT disponibles' })
  getDispositivosIot() {
    return this.service.getDispositivosIot();
  }

  // ==========================================================================
  // HORARIOS DEL PUESTO
  // ==========================================================================

  @Get('puestos/:puestoId/horarios')
  @ApiOperation({ summary: 'Listar horarios del puesto' })
  getHorarios(@Param('puestoId', ParseIntPipe) puestoId: number) {
    return this.service.getHorarios(puestoId);
  }

  @Post('puestos/:puestoId/horarios')
  @ApiOperation({ summary: 'Crear horario dentro del puesto' })
  createHorario(
    @Param('puestoId', ParseIntPipe) puestoId: number,
    @Body() dto: CreateHorarioDto,
  ) {
    return this.service.createHorario(puestoId, dto);
  }

  @Put('horarios/:id')
  @ApiOperation({ summary: 'Actualizar horario' })
  updateHorario(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<CreateHorarioDto>,
  ) {
    return this.service.updateHorario(id, dto);
  }

  @Delete('horarios/:id')
  @ApiOperation({ summary: 'Eliminar horario' })
  deleteHorario(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteHorario(id);
  }

  // ==========================================================================
  // ENLACES PÚBLICOS DE RECOPILACIÓN
  // ==========================================================================

  @Get('puestos/:puestoId/enlaces')
  @ApiOperation({ summary: 'Listar enlaces de recopilación del puesto' })
  getEnlaces(@Param('puestoId', ParseIntPipe) puestoId: number) {
    return this.service.getEnlaces(puestoId);
  }

  @Post('puestos/:puestoId/enlaces')
  @ApiOperation({ summary: 'Crear enlace de recopilación para el puesto' })
  createEnlace(
    @Param('puestoId', ParseIntPipe) puestoId: number,
    @Body() dto: CreateEnlaceDto,
    @CurrentUser() user?: any,
  ) {
    const userId = typeof user === 'object' ? user?.id : user;
    return this.service.createEnlace(puestoId, dto, userId ? Number(userId) : undefined);
  }

  @Delete('enlaces/:id')
  @ApiOperation({ summary: 'Desactivar enlace de recopilación' })
  deleteEnlace(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteEnlace(id);
  }

  @Public()
  @Get('public/recopilacion/:token')
  @ApiOperation({ summary: 'Obtener información pública del enlace de recopilación' })
  getPublicEnlaceInfo(@Param('token') token: string) {
    return this.service.getPublicEnlaceInfo(token);
  }

  @Public()
  @Post('public/recopilacion/:token')
  @ApiOperation({ summary: 'Registrar funcionario mediante formulario público' })
  submitPublicRegistro(
    @Param('token') token: string,
    @Body() dto: RegistroPublicoPersonalDto,
  ) {
    return this.service.submitPublicRegistro(token, dto);
  }

  // ==========================================================================
  // PERSONAL DEL PUESTO
  // ==========================================================================

  @Get('puestos/:puestoId/personal')
  @ApiOperation({ summary: 'Listar personal enrolado en el puesto' })
  getPersonal(@Param('puestoId', ParseIntPipe) puestoId: number) {
    return this.service.getPersonal(puestoId);
  }

  @Post('puestos/:puestoId/personal')
  @ApiOperation({ summary: 'Crear personal manualmente' })
  createPersonalManual(
    @Param('puestoId', ParseIntPipe) puestoId: number,
    @Body() dto: CreatePersonalManualDto,
  ) {
    return this.service.createPersonalManual(puestoId, dto);
  }

  @Delete('personal/:id')
  @ApiOperation({ summary: 'Eliminar personal' })
  deletePersonal(@Param('id', ParseIntPipe) id: number) {
    return this.service.deletePersonal(id);
  }

  // ==========================================================================
  // REGISTROS DE ASISTENCIA
  // ==========================================================================

  @Get('puestos/:puestoId/registros')
  @ApiOperation({ summary: 'Listar marcaciones de asistencia del puesto' })
  getRegistros(
    @Param('puestoId', ParseIntPipe) puestoId: number,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
  ) {
    return this.service.getRegistros(puestoId, fechaInicio, fechaFin);
  }

  @Post('puestos/:puestoId/registros/manual')
  @ApiOperation({ summary: 'Registrar marcación manual' })
  registrarMarcacionManual(
    @Param('puestoId', ParseIntPipe) puestoId: number,
    @Body() dto: ProcesarMarcacionManualDto,
  ) {
    return this.service.registrarMarcacionManual(puestoId, dto);
  }

  // ==========================================================================
  // REPORTES
  // ==========================================================================

  @Get('reportes/puesto/:puestoId')
  @ApiOperation({ summary: 'Reporte de asistencia del puesto (diario / mensual)' })
  getReportePuesto(
    @Param('puestoId', ParseIntPipe) puestoId: number,
    @Query('fechaInicio') fechaInicio: string,
    @Query('fechaFin') fechaFin: string,
  ) {
    return this.service.getReportePuesto(puestoId, fechaInicio, fechaFin);
  }

  @Get('reportes/global')
  @ApiOperation({ summary: 'Reporte global de todos los puestos IoT' })
  getReporteGlobal(
    @Query('fechaInicio') fechaInicio: string,
    @Query('fechaFin') fechaFin: string,
  ) {
    return this.service.getReporteGlobal(fechaInicio, fechaFin);
  }
}
