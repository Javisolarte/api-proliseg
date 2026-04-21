import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { RadioOperacionService } from './radio-operacion.service';
import {
  CreateRadioOperadorDto,
  UpdateRadioOperadorDto,
  CreateReporteDto,
  UpdateReporteDto,
  MarcarChequeoDto,
  MarcarChequeosBulkDto,
  CreateReporteDetalleDto,
} from './dto/radio-operacion.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Radio Operación')
@Controller('radio-operacion')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth('JWT-auth')
export class RadioOperacionController {
  constructor(private readonly radioOperacionService: RadioOperacionService) {}

  // ============================================================
  // RADIO OPERADORES
  // ============================================================

  @Get('operadores')
  @ApiOperation({ summary: 'Listar todos los radio operadores' })
  @ApiResponse({ status: 200, description: 'Lista de radio operadores' })
  async findAllOperadores() {
    return this.radioOperacionService.findAllOperadores();
  }

  @Get('operadores/:id')
  @ApiOperation({ summary: 'Obtener radio operador por ID' })
  @ApiResponse({ status: 200, description: 'Radio operador encontrado' })
  @ApiResponse({ status: 404, description: 'Radio operador no encontrado' })
  async findOneOperador(@Param('id', ParseIntPipe) id: number) {
    return this.radioOperacionService.findOneOperador(id);
  }

  @Post('operadores')
  @ApiOperation({ summary: 'Crear nuevo radio operador' })
  @ApiResponse({ status: 201, description: 'Radio operador creado exitosamente' })
  @ApiResponse({ status: 409, description: 'Empleado ya registrado como radio operador' })
  async createOperador(
    @Body() dto: CreateRadioOperadorDto,
    @CurrentUser() user: any,
  ) {
    return this.radioOperacionService.createOperador(dto, user.id);
  }

  @Put('operadores/:id')
  @ApiOperation({ summary: 'Actualizar radio operador' })
  @ApiResponse({ status: 200, description: 'Radio operador actualizado' })
  async updateOperador(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRadioOperadorDto,
    @CurrentUser() user: any,
  ) {
    return this.radioOperacionService.updateOperador(id, dto, user.id);
  }

  @Delete('operadores/:id')
  @ApiOperation({ summary: 'Desactivar radio operador (soft delete)' })
  @ApiResponse({ status: 200, description: 'Radio operador desactivado' })
  async deleteOperador(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    return this.radioOperacionService.softDeleteOperador(id, user.id);
  }

  // ============================================================
  // REPORTES PUESTOS OPERATIVOS
  // ============================================================

  @Get('reportes')
  @ApiOperation({ summary: 'Listar reportes de puestos operativos' })
  @ApiQuery({ name: 'fecha', required: false, example: '2026-04-15' })
  @ApiQuery({ name: 'turno', required: false, enum: ['dia', 'noche'] })
  @ApiQuery({ name: 'estado', required: false, enum: ['abierto', 'cerrado'] })
  @ApiResponse({ status: 200, description: 'Lista de reportes' })
  async findAllReportes(
    @Query('fecha') fecha?: string,
    @Query('turno') turno?: string,
    @Query('estado') estado?: string,
  ) {
    return this.radioOperacionService.findAllReportes({ fecha, turno, estado });
  }

  @Get('reportes/:id')
  @ApiOperation({ summary: 'Obtener reporte completo con detalle de puestos y chequeos' })
  @ApiResponse({ status: 200, description: 'Reporte con detalle completo' })
  @ApiResponse({ status: 404, description: 'Reporte no encontrado' })
  async findOneReporte(@Param('id', ParseIntPipe) id: number) {
    return this.radioOperacionService.findOneReporte(id);
  }

  @Post('reportes')
  @ApiOperation({ summary: 'Crear nuevo reporte de puestos operativos' })
  @ApiResponse({ status: 201, description: 'Reporte creado con franjas horarias generadas automáticamente' })
  @ApiResponse({ status: 409, description: 'Ya existe un reporte para esa fecha/turno' })
  async createReporte(
    @Body() dto: CreateReporteDto,
    @CurrentUser() user: any,
  ) {
    return this.radioOperacionService.createReporte(dto, user.id);
  }

  @Put('reportes/:id')
  @ApiOperation({ summary: 'Actualizar configuración del reporte (solo si está abierto)' })
  @ApiResponse({ status: 200, description: 'Reporte actualizado' })
  async updateReporte(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReporteDto,
    @CurrentUser() user: any,
  ) {
    return this.radioOperacionService.updateReporte(id, dto, user.id);
  }

  @Patch('reportes/:id/chequeo')
  @ApiOperation({ summary: 'Marcar chequeo individual (sin novedad / novedad / no contesta)' })
  @ApiResponse({ status: 200, description: 'Chequeo marcado' })
  async marcarChequeo(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MarcarChequeoDto,
    @CurrentUser() user: any,
  ) {
    return this.radioOperacionService.marcarChequeo(id, dto, user.id);
  }

  @Patch('reportes/:id/chequeos-bulk')
  @ApiOperation({ summary: 'Marcar múltiples chequeos a la vez' })
  @ApiResponse({ status: 200, description: 'Chequeos marcados' })
  async marcarChequeosBulk(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MarcarChequeosBulkDto,
    @CurrentUser() user: any,
  ) {
    return this.radioOperacionService.marcarChequeosBulk(id, dto, user.id);
  }

  @Post('reportes/:id/cerrar')
  @ApiOperation({ summary: 'Cerrar reporte con firma digital' })
  @ApiResponse({ status: 200, description: 'Reporte cerrado exitosamente' })
  async cerrarReporte(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { firma_operador: string },
    @CurrentUser() user: any,
  ) {
    return this.radioOperacionService.cerrarReporte(id, body.firma_operador, user.id);
  }

  @Post('reportes/:id/reabrir')
  @ApiOperation({ summary: 'Re-abrir reporte para modificación' })
  @ApiResponse({ status: 200, description: 'Reporte re-abierto exitosamente' })
  async reabrirReporte(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    return this.radioOperacionService.reabrirReporte(id, user);
  }

  @Delete('reportes/:id')
  @ApiOperation({ summary: 'Eliminar reporte permanentemente' })
  @ApiResponse({ status: 200, description: 'Reporte eliminado' })
  async deleteReporte(@Param('id', ParseIntPipe) id: number) {
    return this.radioOperacionService.deleteReporte(id);
  }

  @Get('reportes/:id/plantilla')
  @ApiOperation({ summary: 'Generar datos de la plantilla del reporte (formato imprimible)' })
  @ApiResponse({ status: 200, description: 'Datos de la plantilla del reporte' })
  async generarPlantilla(@Param('id', ParseIntPipe) id: number) {
    return this.radioOperacionService.generarPlantilla(id);
  }

  @Get('reportes/:id/pdf')
  @ApiOperation({ summary: 'Descargar reporte completo en formato PDF' })
  @ApiResponse({ status: 200, description: 'Archivo PDF generado' })
  async downloadPdf(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    return this.radioOperacionService.exportReportePDF(id, res);
  }

  @Post('reportes/:id/puestos')
  @ApiOperation({ summary: 'Agregar un puesto a un reporte existente' })
  @ApiResponse({ status: 201, description: 'Puesto agregado al reporte' })
  async addPuesto(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateReporteDetalleDto,
    @CurrentUser() user: any,
  ) {
    return this.radioOperacionService.addPuestoToReporte(id, dto, user.id);
  }

  // ============================================================
  // DASHBOARD
  // ============================================================

  @Get('dashboard/stats')
  @ApiOperation({ summary: 'Estadísticas del dashboard de radio operación' })
  @ApiResponse({ status: 200, description: 'Estadísticas del módulo' })
  async getDashboardStats() {
    return this.radioOperacionService.getDashboardStats();
  }

  @Patch('reportes/:id/detalles/:detalleId')
  @ApiOperation({ summary: 'Actualizar una fila de detalle del reporte (relevo, observaciones)' })
  @ApiResponse({ status: 200, description: 'Detalle actualizado' })
  async updateDetalle(
    @Param('id', ParseIntPipe) id: number,
    @Param('detalleId', ParseIntPipe) detalleId: number,
    @Body() data: any,
    @CurrentUser() user: any,
  ) {
    return this.radioOperacionService.updateReporteDetalle(id, detalleId, data, user.id);
  }
}
