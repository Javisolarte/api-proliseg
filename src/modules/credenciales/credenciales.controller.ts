import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CredencialesService } from './credenciales.service';
import { CreateCredencialDto, UpdateCredencialDto } from './dto/credenciales.dto';

@ApiTags('Credenciales')
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('contraseña')
@ApiBearerAuth('JWT-auth')
export class CredencialesController {
  constructor(private readonly credencialesService: CredencialesService) {}

  @Get('credenciales')
  @RequirePermissions('contraseña')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Listar todas las credenciales de dispositivos' })
  async findAll(
    @Query('tipo_dispositivo') tipo_dispositivo?: string,
    @Query('estado') estado?: string,
    @Query('asignado') asignado?: string
  ) {
    return this.credencialesService.findAll({ tipo_dispositivo, estado, asignado });
  }

  @Get('credenciales/stats')
  @RequirePermissions('contraseña')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Estadísticas de credenciales por tipo y estado' })
  async getStats() {
    return this.credencialesService.getStats();
  }

  @Get('credenciales/:id')
  @RequirePermissions('contraseña')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Obtener detalle de credencial (sin contraseña en texto plano)' })
  async findOne(@Param('id') id: string) {
    return this.credencialesService.findOne(parseInt(id, 10));
  }

  @Get('credenciales/:id/revelar')
  @RequirePermissions('contraseña')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Revelar contraseña/patrón/PIN descifrado' })
  async reveal(@Param('id') id: string) {
    return this.credencialesService.reveal(parseInt(id, 10));
  }

  @Get('credenciales/:id/historial')
  @RequirePermissions('contraseña')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Consultar historial auditor de versiones y cambios anteriores' })
  async getHistorial(@Param('id') id: string) {
    return this.credencialesService.getHistorial(parseInt(id, 10));
  }

  @Post('credenciales')
  @RequirePermissions('contraseña')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Crear nueva credencial de dispositivo' })
  async create(@Body() createDto: CreateCredencialDto, @Req() req: any) {
    const usuarioId = req.user?.id || req.user?.sub;
    return this.credencialesService.create(createDto, usuarioId);
  }

  @Put('credenciales/:id')
  @RequirePermissions('contraseña')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Actualizar credencial existente' })
  async update(@Param('id') id: string, @Body() updateDto: UpdateCredencialDto, @Req() req: any) {
    const usuarioId = req.user?.id || req.user?.sub;
    return this.credencialesService.update(parseInt(id, 10), updateDto, usuarioId);
  }

  @Delete('credenciales/:id')
  @RequirePermissions('contraseña')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Eliminar credencial de dispositivo' })
  async remove(@Param('id') id: string) {
    return this.credencialesService.remove(parseInt(id, 10));
  }
}
