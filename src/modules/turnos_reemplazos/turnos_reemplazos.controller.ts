import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  NotFoundException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from "@nestjs/swagger";
import { TurnosReemplazosService } from "./turnos_reemplazos.service";
import {
  CreateTurnoReemplazoDto,
  UpdateTurnoReemplazoDto,
} from "./dto/turnos_reemplazos.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";

@ApiTags("Turnos Reemplazos")
@Controller("turnos-reemplazos")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class TurnosReemplazosController {
  constructor(private readonly service: TurnosReemplazosService) {}

  /**
   * 📋 Listar reemplazos existentes
   */
  @Get()
  @RequirePermissions("turnos_reemplazos")
  @ApiOperation({ summary: "Listar todos los reemplazos de turno" })
  @ApiResponse({ status: 200, description: "Lista de reemplazos obtenida correctamente" })
  async findAll() {
    const data = await this.service.findAll();
    if (!data || data.length === 0) {
      throw new NotFoundException("No hay reemplazos registrados");
    }
    return data;
  }

  /**
   * 🔎 Obtener un reemplazo por ID
   */
  @Get(":id")
  @RequirePermissions("turnos_reemplazos")
  @ApiOperation({ summary: "Obtener un reemplazo por ID" })
  @ApiResponse({ status: 200, description: "Reemplazo encontrado" })
  @ApiResponse({ status: 404, description: "Reemplazo no encontrado" })
  async findOne(@Param("id") id: string) {
    const data = await this.service.findOne(Number(id));
    if (!data) throw new NotFoundException(`Reemplazo con ID ${id} no encontrado`);
    return data;
  }

  /**
   * 🤖 Crear reemplazo o mostrar sugerencias (IA + distancia)
   */
  @Post()
  @RequirePermissions("turnos_reemplazos")
  @ApiOperation({
    summary: "Crear un reemplazo de turno o mostrar sugerencias inteligentes (IA + distancia)",
  })
  @ApiBody({ type: CreateTurnoReemplazoDto })
  @ApiResponse({
    status: 201,
    description:
      "Devuelve sugerencias si no se indica empleado_reemplazo_id. Si se indica, crea el reemplazo.",
  })
  async create(@Body() dto: CreateTurnoReemplazoDto): Promise<any> {
  return this.service.create(dto);/**
   * ✏️ ojo cambiar
   */
}


  /**
   * ✏️ Actualizar un reemplazo
   */
  @Put(":id")
  @RequirePermissions("turnos_reemplazos")
  @ApiOperation({ summary: "Actualizar datos de un reemplazo existente" })
  @ApiBody({ type: UpdateTurnoReemplazoDto })
  @ApiResponse({ status: 200, description: "Reemplazo actualizado correctamente" })
  async update(@Param("id") id: string, @Body() dto: UpdateTurnoReemplazoDto) {
    return this.service.update(Number(id), dto);
  }

  /**
   * 🗑️ Eliminar un reemplazo
   */
  @Delete(":id")
  @RequirePermissions("turnos_reemplazos")
  @ApiOperation({ summary: "Eliminar un reemplazo de turno" })
  @ApiResponse({ status: 200, description: "Reemplazo eliminado correctamente" })
  async remove(@Param("id") id: string) {
    return this.service.remove(Number(id));
  }
}
