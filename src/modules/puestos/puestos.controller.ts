import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from "@nestjs/common"
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger"
import type { PuestosService } from "./puestos.service"
import type { CreatePuestoDto, UpdatePuestoDto } from "./dto/puesto.dto"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { PermissionsGuard } from "../auth/guards/permissions.guard"
import { RequirePermissions } from "../auth/decorators/permissions.decorator"

@ApiTags("Puestos")
@Controller("puestos")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class PuestosController {
  constructor(private readonly puestosService: PuestosService) {}

  @Get()
  @RequirePermissions("puestos_trabajo")
  @ApiOperation({ summary: "Listar todos los puestos de trabajo" })
  @ApiResponse({ status: 200, description: "Lista de puestos" })
  async findAll() {
    return this.puestosService.findAll()
  }

  @Get(':id')
  @RequirePermissions('puestos_trabajo')
  @ApiOperation({ summary: 'Obtener puesto por ID' })
  @ApiResponse({ status: 200, description: 'Puesto encontrado' })
  async findOne(@Param('id') id: string) {
    return this.puestosService.findOne(Number.parseInt(id));
  }

  @Post()
  @RequirePermissions('puestos_trabajo')
  @ApiOperation({ summary: 'Crear nuevo puesto de trabajo' })
  @ApiResponse({ status: 201, description: 'Puesto creado exitosamente' })
  async create(@Body() createPuestoDto: CreatePuestoDto) {
    return this.puestosService.create(createPuestoDto);
  }

  @Put(":id")
  @RequirePermissions("puestos_trabajo")
  @ApiOperation({ summary: "Actualizar puesto de trabajo" })
  @ApiResponse({ status: 200, description: "Puesto actualizado exitosamente" })
  async update(@Param('id') id: string, @Body() updatePuestoDto: UpdatePuestoDto) {
    return this.puestosService.update(Number.parseInt(id), updatePuestoDto)
  }

  @Delete(':id')
  @RequirePermissions('puestos_trabajo')
  @ApiOperation({ summary: 'Eliminar puesto de trabajo' })
  @ApiResponse({ status: 200, description: 'Puesto eliminado exitosamente' })
  async remove(@Param('id') id: string) {
    return this.puestosService.remove(Number.parseInt(id));
  }
}
