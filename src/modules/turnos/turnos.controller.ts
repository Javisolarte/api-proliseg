import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, ParseIntPipe } from "@nestjs/common"
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger"
import { TurnosService } from "./turnos.service"
import type { CreateTurnoDto, UpdateTurnoDto } from "./dto/turno.dto"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { PermissionsGuard } from "../auth/guards/permissions.guard"
import { RequirePermissions } from "../auth/decorators/permissions.decorator"
import { CurrentUser } from "../auth/decorators/current-user.decorator"

@ApiTags("Turnos")
@Controller("turnos")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class TurnosController {
  constructor(private readonly turnosService: TurnosService) {}

  @Get()
  @RequirePermissions("turnos")
  @ApiOperation({ summary: "Listar todos los turnos" })
  @ApiResponse({ status: 200, description: "Lista de turnos" })
  async findAll(
    @Query("fecha") fecha?: string,
    @Query("empleado_id") empleadoId?: number,
    @Query("puesto_id") puestoId?: number,
  ) {
    return this.turnosService.findAll({ fecha, empleadoId, puestoId })
  }

  @Get(":id")
  @RequirePermissions("turnos")
  @ApiOperation({ summary: "Obtener turno por ID" })
  @ApiResponse({ status: 200, description: "Turno encontrado" })
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.turnosService.findOne(id)
  }

  @Post()
  @RequirePermissions("turnos")
  @ApiOperation({ summary: "Crear nuevo turno" })
  @ApiResponse({ status: 201, description: "Turno creado exitosamente" })
  async create(@Body() createTurnoDto: CreateTurnoDto, @CurrentUser() user: any) {
    return this.turnosService.create(createTurnoDto, user.id)
  }

  @Put(":id")
  @RequirePermissions("turnos")
  @ApiOperation({ summary: "Actualizar turno" })
  @ApiResponse({ status: 200, description: "Turno actualizado exitosamente" })
  async update(@Param("id", ParseIntPipe) id: number, @Body() updateTurnoDto: UpdateTurnoDto) {
    return this.turnosService.update(id, updateTurnoDto)
  }

  @Delete(":id")
  @RequirePermissions("turnos")
  @ApiOperation({ summary: "Eliminar turno" })
  @ApiResponse({ status: 200, description: "Turno eliminado exitosamente" })
  async remove(@Param("id", ParseIntPipe) id: number) {
    return this.turnosService.remove(id)
  }
}
