import { Controller, Get, Post, Put, Delete, Patch, Body, Param, UseGuards, Query, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AlarmasService } from './alarmas.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Monitoreo de Alarmas')
@Controller('alarmas')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth('JWT-auth')
export class AlarmasController {
  constructor(private readonly alarmasService: AlarmasService) { }

  // ─── PANELES DE ALARMA ────────────────────────────────────────────────────

  @Get('paneles')
  @RequirePermissions('monitoreo')
  @ApiOperation({ summary: 'Listar todos los paneles de alarma registrados' })
  async getPaneles() {
    return this.alarmasService.findAllPaneles();
  }

  @Get('paneles/:id')
  @RequirePermissions('monitoreo')
  @ApiOperation({ summary: 'Obtener información detallada de un panel (zonas, usuarios, contactos)' })
  async getPanelDetail(@Param('id') id: string) {
    return this.alarmasService.findOnePanel(id);
  }

  @Post('paneles')
  @RequirePermissions('monitoreo')
  @ApiOperation({ summary: 'Registrar un nuevo panel de alarma' })
  async createPanel(@Body() body: any) {
    return this.alarmasService.createPanel(body);
  }

  @Put('paneles/:id')
  @RequirePermissions('monitoreo')
  @ApiOperation({ summary: 'Actualizar la configuración de un panel de alarma' })
  async updatePanel(@Param('id') id: string, @Body() body: any) {
    return this.alarmasService.updatePanel(id, body);
  }

  @Delete('paneles/:id')
  @RequirePermissions('monitoreo')
  @ApiOperation({ summary: 'Eliminar un panel de alarma' })
  async deletePanel(@Param('id') id: string) {
    return this.alarmasService.deletePanel(id);
  }

  // ─── ZONAS DE ALARMA ──────────────────────────────────────────────────────

  @Get('paneles/:panelId/zonas')
  @RequirePermissions('monitoreo')
  @ApiOperation({ summary: 'Listar las zonas configuradas en un panel' })
  async getZonas(@Param('panelId') panelId: string) {
    return this.alarmasService.findZonesByPanel(panelId);
  }

  @Post('zonas')
  @RequirePermissions('monitoreo')
  @ApiOperation({ summary: 'Registrar una zona en un panel de alarma' })
  async createZona(@Body() body: any) {
    return this.alarmasService.createZone(body);
  }

  @Put('zonas/:id')
  @RequirePermissions('monitoreo')
  @ApiOperation({ summary: 'Actualizar una zona de alarma' })
  async updateZona(@Param('id') id: string, @Body() body: any) {
    return this.alarmasService.updateZone(id, body);
  }

  @Delete('zonas/:id')
  @RequirePermissions('monitoreo')
  @ApiOperation({ summary: 'Eliminar una zona de alarma' })
  async deleteZona(@Param('id') id: string) {
    return this.alarmasService.deleteZone(id);
  }

  // ─── PARTICIONES DE ALARMA ───────────────────────────────────────────────

  @Get('paneles/:panelId/particiones')
  @RequirePermissions('monitoreo')
  @ApiOperation({ summary: 'Listar las particiones configuradas en un panel' })
  async getParticiones(@Param('panelId') panelId: string) {
    return this.alarmasService.findPartitionsByPanel(panelId);
  }

  @Post('particiones')
  @RequirePermissions('monitoreo')
  @ApiOperation({ summary: 'Registrar una partición en un panel de alarma' })
  async createParticion(@Body() body: any) {
    return this.alarmasService.createPartition(body);
  }

  @Put('particiones/:id')
  @RequirePermissions('monitoreo')
  @ApiOperation({ summary: 'Actualizar una partición de alarma' })
  async updateParticion(@Param('id') id: string, @Body() body: any) {
    return this.alarmasService.updatePartition(id, body);
  }

  @Delete('particiones/:id')
  @RequirePermissions('monitoreo')
  @ApiOperation({ summary: 'Eliminar una partición de alarma' })
  async deleteParticion(@Param('id') id: string) {
    return this.alarmasService.deletePartition(id);
  }

  // ─── USUARIOS DEL PANEL ───────────────────────────────────────────────────

  @Get('paneles/:panelId/usuarios')
  @RequirePermissions('monitoreo')
  @ApiOperation({ summary: 'Listar los usuarios configurados en el panel físico' })
  async getUsuariosPanel(@Param('panelId') panelId: string) {
    return this.alarmasService.findUsersByPanel(panelId);
  }

  @Post('usuarios')
  @RequirePermissions('monitoreo')
  @ApiOperation({ summary: 'Registrar un usuario de panel' })
  async createUsuarioPanel(@Body() body: any) {
    return this.alarmasService.createUser(body);
  }

  @Put('usuarios/:id')
  @RequirePermissions('monitoreo')
  @ApiOperation({ summary: 'Actualizar un usuario de panel' })
  async updateUsuarioPanel(@Param('id') id: string, @Body() body: any) {
    return this.alarmasService.updateUser(id, body);
  }

  @Delete('usuarios/:id')
  @RequirePermissions('monitoreo')
  @ApiOperation({ summary: 'Eliminar un usuario de panel' })
  async deleteUsuarioPanel(@Param('id') id: string) {
    return this.alarmasService.deleteUser(id);
  }

  // ─── CONTACTOS DE EMERGENCIA ──────────────────────────────────────────────

  @Get('paneles/:panelId/contactos')
  @RequirePermissions('monitoreo')
  @ApiOperation({ summary: 'Listar contactos telefónicos de emergencia asignados al panel' })
  async getContactos(@Param('panelId') panelId: string) {
    return this.alarmasService.findContactsByPanel(panelId);
  }

  @Post('contactos')
  @RequirePermissions('monitoreo')
  @ApiOperation({ summary: 'Registrar contacto telefónico de emergencia' })
  async createContacto(@Body() body: any) {
    return this.alarmasService.createContact(body);
  }

  @Put('contactos/:id')
  @RequirePermissions('monitoreo')
  @ApiOperation({ summary: 'Actualizar contacto telefónico de emergencia' })
  async updateContacto(@Param('id') id: string, @Body() body: any) {
    return this.alarmasService.updateContact(id, body);
  }

  @Delete('contactos/:id')
  @RequirePermissions('monitoreo')
  @ApiOperation({ summary: 'Eliminar contacto de emergencia' })
  async deleteContacto(@Param('id') id: string) {
    return this.alarmasService.deleteContact(id);
  }

  // ─── COLA DE MONITOREO Y HISTORIAL ────────────────────────────────────────

  @Get('eventos/pendientes')
  @RequirePermissions('monitoreo')
  @ApiOperation({ summary: 'Obtener señales pendientes de atención (Cola del Operador)' })
  async getPendientes() {
    return this.alarmasService.getColaMonitoreo();
  }

  @Get('eventos/historial')
  @RequirePermissions('monitoreo')
  @ApiOperation({ summary: 'Obtener historial completo de eventos decodificados' })
  async getHistorial(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('panel_id') panelId?: string,
    @Query('tipo_evento') tipoEvento?: string,
    @Query('estado_gestion') estadoGestion?: string,
  ) {
    return this.alarmasService.getHistorial({ limit, offset, panel_id: panelId, tipo_evento: tipoEvento, estado_gestion: estadoGestion });
  }

  // ─── ACCIONES DE GESTIÓN OPERATIVA ────────────────────────────────────────

  @Patch('eventos/:id/atender')
  @RequirePermissions('monitoreo')
  @ApiOperation({ summary: 'Marcar una alarma como "En Proceso" y asignarla al operador logueado' })
  async atenderAlarma(@Param('id') id: string, @Request() req: any) {
    const operadorId = req.user?.id;
    return this.alarmasService.atenderAlarma(id, operadorId);
  }

  @Patch('eventos/:id/cerrar')
  @RequirePermissions('monitoreo')
  @ApiOperation({ summary: 'Marcar una alarma como resuelta ("atendido", "falsa_alarma") y registrar notas' })
  async cerrarAlarma(
    @Param('id') id: string,
    @Body() body: { estado_gestion: string; comentarios_operador: string },
    @Request() req: any,
  ) {
    const operadorId = req.user?.id;
    return this.alarmasService.cerrarAlarma(id, {
      estado_gestion: body.estado_gestion,
      comentarios_operador: body.comentarios_operador,
      operador_id: operadorId,
    });
  }

  @Get('eventos/:id/bitacora')
  @RequirePermissions('monitoreo')
  @ApiOperation({ summary: 'Obtener bitácora de llamadas y notas de atención para esta alerta' })
  async getBitacora(@Param('id') id: string) {
    return this.alarmasService.getBitacora(id);
  }

  @Post('eventos/:id/bitacora')
  @RequirePermissions('monitoreo')
  @ApiOperation({ summary: 'Registrar llamada o paso de protocolo en la bitácora de atención' })
  async registrarPaso(
    @Param('id') id: string,
    @Body() body: { paso_realizado: string; detalle_resultado: string },
    @Request() req: any,
  ) {
    const operadorId = req.user?.id;
    return this.alarmasService.registrarBitacoraPaso(id, {
      paso_realizado: body.paso_realizado,
      detalle_resultado: body.detalle_resultado,
      operador_id: operadorId,
    });
  }
}
