import { Controller, Get, Post, Body, Param, Query, UseGuards, ParseIntPipe } from "@nestjs/common"
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger"
import { AsistenciasService } from "./asistencias.service"
import type { CreateAsistenciaDto } from "./dto/asistencia.dto"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { PermissionsGuard } from "../auth/guards/permissions.guard"
import { RequirePermissions } from "../auth/decorators/permissions.decorator"
import { CurrentUser } from "../auth/decorators/current-user.decorator"

@ApiTags("Asistencias")
@Controller("asistencias")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class AsistenciasController {
  constructor(private readonly asistenciasService: AsistenciasService) {}

  @Get()
  @RequirePermissions("asistencias")
  @ApiOperation({ summary: "Listar todas las asistencias" })
  @ApiResponse({ status: 200, description: "Lista de asistencias" })
  async findAll(
    @Query('turno_id') turnoId?: number,
    @Query('fecha_inicio') fechaInicio?: string,
    @Query('fecha_fin') fechaFin?: string,
  ) {
    return this.asistenciasService.findAll({ turnoId, fechaInicio, fechaFin })
  }

  @Get(':id')
  @RequirePermissions('asistencias')
  @ApiOperation({ summary: 'Obtener asistencia por ID' })
  @ApiResponse({ status: 200, description: 'Asistencia encontrada' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.asistenciasService.findOne(id);
  }

  @Post()
  @RequirePermissions("asistencias")
  @ApiOperation({ summary: "Registrar asistencia (entrada/salida)" })
  @ApiResponse({ status: 201, description: "Asistencia registrada exitosamente" })
  async create(@Body() createAsistenciaDto: CreateAsistenciaDto, @CurrentUser() user: any) {
    return this.asistenciasService.create(createAsistenciaDto, user.id)
  }
}
