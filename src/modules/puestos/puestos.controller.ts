import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Delete,
  UseGuards,
  Request,
  ParseIntPipe,
} from "@nestjs/common";
import { PuestosService } from "./puestos.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CreatePuestoDto, UpdatePuestoDto } from "./dto/puesto.dto";
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";

@ApiTags("Puestos")
@Controller("puestos")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class PuestosController {
  constructor(private readonly puestosService: PuestosService) { }

  @Get()
  @RequirePermissions("puestos")
  @ApiOperation({ summary: "Listar todos los puestos de trabajo" })
  findAll() {
    return this.puestosService.findAll();
  }

  @Get(":id")
  @RequirePermissions("puestos")
  @ApiOperation({ summary: "Obtener un puesto específico por ID" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.puestosService.findOne(id);
  }

  @Post()
  @RequirePermissions("puestos")
  @ApiOperation({ summary: "Crear un nuevo puesto de trabajo" })
  create(@Body() dto: CreatePuestoDto, @Request() req) {
    return this.puestosService.create(dto, req.user.id);
  }

  @Put(":id")
  @RequirePermissions("puestos")
  @ApiOperation({ summary: "Actualizar los datos de un puesto" })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdatePuestoDto,
    @Request() req
  ) {
    return this.puestosService.update(id, dto, req.user.id);
  }

  @Delete(":id")
  @RequirePermissions("puestos")
  @ApiOperation({ summary: "Eliminar (soft delete) un puesto" })
  softDelete(@Param("id", ParseIntPipe) id: number, @Request() req) {
    return this.puestosService.softDelete(id, req.user.id);
  }

  @Get(":id/subpuestos")
  @RequirePermissions("puestos")
  @ApiOperation({
    summary: "Obtener subpuestos de un puesto",
    description: "Lista todos los subpuestos (unidades operativas) asociados a un puesto de trabajo. Los subpuestos contienen la lógica operativa real: guardas activos, configuración de turnos, etc."
  })
  @ApiResponse({
    status: 200,
    description: "Lista de subpuestos con su configuración de turnos",
    schema: {
      example: [
        {
          id: 1,
          puesto_id: 5,
          nombre: "Subpuesto General",
          descripcion: "Subpuesto principal",
          guardas_activos: 1,
          configuracion_id: 2,
          activo: true,
          configuracion: {
            id: 2,
            nombre: "2D-2N-2Z",
            dias_ciclo: 6,
            activo: true
          }
        }
      ]
    }
  })
  getSubpuestos(@Param("id", ParseIntPipe) id: number) {
    return this.puestosService.getSubpuestos(id);
  }
}
