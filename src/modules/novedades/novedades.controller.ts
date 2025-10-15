import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from "@nestjs/common"
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger"
import type { NovedadesService } from "./novedades.service"
import type { CreateNovedadDto, UpdateNovedadDto } from "./dto/novedad.dto"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { PermissionsGuard } from "../auth/guards/permissions.guard"
import { RequirePermissions } from "../auth/decorators/permissions.decorator"
import { CurrentUser } from "../auth/decorators/current-user.decorator"

@ApiTags("Novedades")
@Controller("novedades")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class NovedadesController {
  constructor(private readonly novedadesService: NovedadesService) {}

  @Get()
  @RequirePermissions("novedades")
  @ApiOperation({ summary: "Listar todas las novedades" })
  @ApiResponse({ status: 200, description: "Lista de novedades" })
  async findAll() {
    return this.novedadesService.findAll()
  }

  @Get(':id')
  @RequirePermissions('novedades')
  @ApiOperation({ summary: 'Obtener novedad por ID' })
  @ApiResponse({ status: 200, description: 'Novedad encontrada' })
  async findOne(@Param('id') id: number) {
    return this.novedadesService.findOne(id);
  }

  @Post()
  @RequirePermissions("novedades")
  @ApiOperation({ summary: "Crear nueva novedad" })
  @ApiResponse({ status: 201, description: "Novedad creada exitosamente" })
  async create(@Body() createNovedadDto: CreateNovedadDto, @CurrentUser() user: any) {
    return this.novedadesService.create(createNovedadDto, user.id)
  }

  @Put(":id")
  @RequirePermissions("novedades")
  @ApiOperation({ summary: "Actualizar novedad" })
  @ApiResponse({ status: 200, description: "Novedad actualizada exitosamente" })
  async update(@Param('id') id: number, @Body() updateNovedadDto: UpdateNovedadDto) {
    return this.novedadesService.update(id, updateNovedadDto)
  }

  @Delete(':id')
  @RequirePermissions('novedades')
  @ApiOperation({ summary: 'Eliminar novedad' })
  @ApiResponse({ status: 200, description: 'Novedad eliminada exitosamente' })
  async remove(@Param('id') id: number) {
    return this.novedadesService.remove(id);
  }
}
