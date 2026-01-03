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
import { SubpuestosService } from "./subpuestos.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CreateSubpuestoDto, UpdateSubpuestoDto } from "./dto/subpuesto.dto";
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from "@nestjs/swagger";

@ApiTags("Subpuestos")
@Controller("subpuestos")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class SubpuestosController {
  constructor(private readonly subpuestosService: SubpuestosService) { }

  @Get()
  @RequirePermissions("puestos")
  @ApiOperation({ summary: "Obtener todos los subpuestos" })
  @ApiResponse({ status: 200, description: "Lista de subpuestos obtenida" })
  findAll() {
    return this.subpuestosService.findAll();
  }

  @Get(":id")
  @RequirePermissions("puestos")
  @ApiOperation({ summary: "Obtener un subpuesto por ID" })
  @ApiResponse({ status: 200, description: "Subpuesto encontrado" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.subpuestosService.findOne(id);
  }

  @Post()
  @RequirePermissions("puestos")
  @ApiOperation({ summary: "Crear un nuevo subpuesto" })
  @ApiResponse({ status: 201, description: "Subpuesto creado exitosamente" })
  create(@Body() dto: CreateSubpuestoDto, @Request() req) {
    return this.subpuestosService.create(dto, req.user.id);
  }

  @Put(":id")
  @RequirePermissions("puestos")
  @ApiOperation({ summary: "Actualizar un subpuesto existente" })
  @ApiResponse({ status: 200, description: "Subpuesto actualizado exitosamente" })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateSubpuestoDto,
    @Request() req
  ) {
    return this.subpuestosService.update(id, dto, req.user.id);
  }

  @Delete(":id")
  @RequirePermissions("puestos")
  @ApiOperation({ summary: "Eliminar permanentemente un subpuesto" })
  @ApiResponse({ status: 200, description: "Subpuesto eliminado exitosamente" })
  remove(@Param("id", ParseIntPipe) id: number, @Request() req) {
    return this.subpuestosService.remove(id, req.user.id);
  }

  @Get(":id/guardas-necesarios")
  @RequirePermissions("puestos")
  @ApiOperation({
    summary: "Obtener cálculo de guardas necesarios del subpuesto",
    description: "Retorna guardas activos, estados del ciclo, guardas necesarios calculados, empleados asignados y cupos disponibles"
  })
  @ApiResponse({
    status: 200,
    description: "Cálculo de guardas necesarios",
    schema: {
      example: {
        subpuesto_id: 1,
        nombre: "Subpuesto A - Entrada Principal",
        guardas_activos: 1,
        estados_ciclo: 3,
        guardas_necesarios: 3,
        empleados_asignados: 2,
        cupos_disponibles: 1
      }
    }
  })
  getGuardasNecesarios(@Param("id", ParseIntPipe) id: number) {
    return this.subpuestosService.getGuardasNecesarios(id);
  }

  @Get(":id/empleados-activos")
  @RequirePermissions("puestos")
  @ApiOperation({
    summary: "Obtener empleados activos asignados al subpuesto",
    description: "Lista todos los empleados actualmente asignados a este subpuesto con sus datos básicos"
  })
  @ApiResponse({
    status: 200,
    description: "Lista de empleados activos",
    schema: {
      example: {
        subpuesto_id: 1,
        total_empleados: 2,
        empleados: [
          {
            id: 1,
            fecha_asignacion: "2025-01-15",
            empleado: {
              id: 10,
              nombre_completo: "Juan Pérez",
              cedula: "1234567890",
              telefono: "3001234567",
              correo: "juan@example.com"
            }
          }
        ]
      }
    }
  })
  getEmpleadosActivos(@Param("id", ParseIntPipe) id: number) {
    return this.subpuestosService.getEmpleadosActivos(id);
  }
}
