import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from "@nestjs/common"
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger"
import type { MinutasService } from "./minutas.service"
import type { CreateMinutaDto, UpdateMinutaDto } from "./dto/minuta.dto"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { PermissionsGuard } from "../auth/guards/permissions.guard"
import { RequirePermissions } from "../auth/decorators/permissions.decorator"
import { CurrentUser } from "../auth/decorators/current-user.decorator"

@ApiTags("Minutas")
@Controller("minutas")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class MinutasController {
  constructor(private readonly minutasService: MinutasService) {}

  @Get()
  @RequirePermissions("minutas")
  @ApiOperation({ summary: "Listar todas las minutas" })
  @ApiResponse({ status: 200, description: "Lista de minutas" })
  async findAll() {
    return this.minutasService.findAll()
  }

  @Get(':id')
  @RequirePermissions('minutas')
  @ApiOperation({ summary: 'Obtener minuta por ID' })
  @ApiResponse({ status: 200, description: 'Minuta encontrada' })
  async findOne(@Param('id') id: number) {
    return this.minutasService.findOne(id);
  }

  @Post()
  @RequirePermissions("minutas")
  @ApiOperation({ summary: "Crear nueva minuta" })
  @ApiResponse({ status: 201, description: "Minuta creada exitosamente" })
  async create(@Body() createMinutaDto: CreateMinutaDto, @CurrentUser() user: any) {
    return this.minutasService.create(createMinutaDto, user.id)
  }

  @Put(":id")
  @RequirePermissions("minutas")
  @ApiOperation({ summary: "Actualizar minuta" })
  @ApiResponse({ status: 200, description: "Minuta actualizada exitosamente" })
  async update(@Param('id') id: number, @Body() updateMinutaDto: UpdateMinutaDto) {
    return this.minutasService.update(id, updateMinutaDto)
  }

  @Delete(':id')
  @RequirePermissions('minutas')
  @ApiOperation({ summary: 'Eliminar minuta' })
  @ApiResponse({ status: 200, description: 'Minuta eliminada exitosamente' })
  async remove(@Param('id') id: number) {
    return this.minutasService.remove(id);
  }
}
