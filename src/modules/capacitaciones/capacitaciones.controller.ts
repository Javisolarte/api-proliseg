import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from "@nestjs/common"
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger"
import type { CapacitacionesService } from "./capacitaciones.service"
import type { CreateCapacitacionDto, UpdateCapacitacionDto } from "./dto/capacitacion.dto"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { PermissionsGuard } from "../auth/guards/permissions.guard"
import { RequirePermissions } from "../auth/decorators/permissions.decorator"

@ApiTags("Capacitaciones")
@Controller("capacitaciones")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class CapacitacionesController {
  constructor(private readonly capacitacionesService: CapacitacionesService) {}

  @Get()
  @RequirePermissions("capacitaciones")
  @ApiOperation({ summary: "Listar todas las capacitaciones" })
  @ApiResponse({ status: 200, description: "Lista de capacitaciones" })
  async findAll() {
    return this.capacitacionesService.findAll()
  }

  @Get(":id")
  @RequirePermissions("capacitaciones")
  @ApiOperation({ summary: "Obtener capacitación por ID" })
  @ApiResponse({ status: 200, description: "Capacitación encontrada" })
  async findOne(@Param("id") id: number) {
    return this.capacitacionesService.findOne(id)
  }

  @Post()
  @RequirePermissions("capacitaciones")
  @ApiOperation({ summary: "Crear nueva capacitación" })
  @ApiResponse({ status: 201, description: "Capacitación creada exitosamente" })
  async create(@Body() createCapacitacionDto: CreateCapacitacionDto) {
    return this.capacitacionesService.create(createCapacitacionDto)
  }

  @Put(":id")
  @RequirePermissions("capacitaciones")
  @ApiOperation({ summary: "Actualizar capacitación" })
  @ApiResponse({ status: 200, description: "Capacitación actualizada exitosamente" })
  async update(@Param("id") id: number, @Body() updateCapacitacionDto: UpdateCapacitacionDto) {
    return this.capacitacionesService.update(id, updateCapacitacionDto)
  }

  @Delete(":id")
  @RequirePermissions("capacitaciones")
  @ApiOperation({ summary: "Eliminar capacitación" })
  @ApiResponse({ status: 200, description: "Capacitación eliminada exitosamente" })
  async remove(@Param("id") id: number) {
    return this.capacitacionesService.remove(id)
  }
}
