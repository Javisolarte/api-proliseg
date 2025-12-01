import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, ParseIntPipe } from "@nestjs/common"
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger"
import { IncidentesService } from "./incidentes.service"
import type { CreateIncidenteDto, UpdateIncidenteDto } from "./dto/incidente.dto"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { PermissionsGuard } from "../auth/guards/permissions.guard"
import { RequirePermissions } from "../auth/decorators/permissions.decorator"
import { CurrentUser } from "../auth/decorators/current-user.decorator"

@ApiTags("Incidentes")
@Controller("incidentes")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class IncidentesController {
  constructor(private readonly incidentesService: IncidentesService) { }

  @Get()
  @RequirePermissions("incidentes")
  @ApiOperation({ summary: "Listar todos los incidentes" })
  @ApiResponse({ status: 200, description: "Lista de incidentes" })
  async findAll(@Query('estado') estado?: string, @Query('nivel_gravedad') nivelGravedad?: string) {
    return this.incidentesService.findAll({ estado, nivelGravedad })
  }

  @Get(':id')
  @RequirePermissions('incidentes')
  @ApiOperation({ summary: 'Obtener incidente por ID' })
  @ApiResponse({ status: 200, description: 'Incidente encontrado' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.incidentesService.findOne(id);
  }

  @Post()
  @RequirePermissions("incidentes")
  @ApiOperation({ summary: "Reportar nuevo incidente" })
  @ApiResponse({ status: 201, description: "Incidente reportado exitosamente" })
  async create(@Body() createIncidenteDto: CreateIncidenteDto, @CurrentUser() user: any) {
    return this.incidentesService.create(createIncidenteDto, user.id)
  }

  @Put(":id")
  @RequirePermissions("incidentes")
  @ApiOperation({ summary: "Actualizar incidente" })
  @ApiResponse({ status: 200, description: "Incidente actualizado exitosamente" })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateIncidenteDto: UpdateIncidenteDto,
    @CurrentUser() user: any,
  ) {
    return this.incidentesService.update(id, updateIncidenteDto, user.id)
  }
}
