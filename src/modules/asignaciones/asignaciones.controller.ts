import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from "@nestjs/swagger";
import { AsignacionesService } from "./asignaciones.service";
import { CreateAsignacionDto, UpdateAsignacionDto } from "./dto/asignacion.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";

@ApiTags("Asignaciones de guardas")
@Controller("asignaciones")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class AsignacionesController {
  constructor(private readonly asignacionesService: AsignacionesService) {}

  @Get()
  @RequirePermissions("asignaciones")
  @ApiOperation({ summary: "Listar todas las asignaciones" })
  async findAll() {
    return this.asignacionesService.findAll();
  }

  @Get(":id")
  @RequirePermissions("asignaciones")
  @ApiOperation({ summary: "Obtener una asignación por ID" })
  async findOne(@Param("id") id: number) {
    return this.asignacionesService.findOne(id);
  }

  @Post()
  @RequirePermissions("asignaciones")
  @ApiOperation({ summary: "Crear nueva asignación" })
  @ApiBody({ type: CreateAsignacionDto })
  @ApiResponse({ status: 201, description: "Asignación creada exitosamente" })
  async create(@Body() dto: CreateAsignacionDto) {
    return this.asignacionesService.create(dto);
  }

  @Put(":id")
  @RequirePermissions("asignaciones")
  @ApiOperation({ summary: "Actualizar asignación existente" })
  @ApiBody({ type: UpdateAsignacionDto })
  async update(@Param("id") id: number, @Body() dto: UpdateAsignacionDto) {
    return this.asignacionesService.update(id, dto);
  }

  @Delete(":id")
  @RequirePermissions("asignaciones")
  @ApiOperation({ summary: "Eliminar (soft delete) una asignación" })
  async remove(@Param("id") id: number) {
    return this.asignacionesService.remove(id);
  }
}
