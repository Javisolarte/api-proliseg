import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  ParseIntPipe,
  Query,
} from "@nestjs/common";
import { TurnosService } from "./turnos.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CreateTurnoDto, UpdateTurnoDto } from "./dto/turno.dto";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";

@ApiTags("Turnos")
@Controller("turnos")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class TurnosController {
  constructor(private readonly turnosService: TurnosService) {}

  // ✅ Listar todos los turnos (con filtros opcionales)
  @Get()
  @RequirePermissions("turnos")
  @ApiOperation({ summary: "Listar todos los turnos (con filtros opcionales)" })
  findAll(
    @Query("fecha") fecha?: string,
    @Query("empleado_id") empleadoId?: number,
    @Query("puesto_id") puestoId?: number
  ) {
    return this.turnosService.findAll({ fecha, empleadoId, puestoId });
  }

  // ✅ Obtener todos los turnos de un empleado específico
  @Get("empleado/:empleadoId")
  @RequirePermissions("turnos")
  @ApiOperation({ summary: "Obtener todos los turnos de un empleado específico" })
  findByEmpleado(@Param("empleadoId", ParseIntPipe) empleadoId: number) {
    return this.turnosService.findByEmpleado(empleadoId);
  }

  // ✅ Crear un nuevo turno
  @Post()
  @RequirePermissions("turnos")
  @ApiOperation({ summary: "Crear un nuevo turno" })
  create(@Body() dto: CreateTurnoDto, @Request() req) {
    return this.turnosService.create(dto, req.user.id);
  }

  // ✅ Actualizar todos los turnos de un empleado
  @Put("empleado/:empleadoId")
  @RequirePermissions("turnos")
  @ApiOperation({ summary: "Actualizar todos los turnos de un empleado" })
  updateByEmpleado(
    @Param("empleadoId", ParseIntPipe) empleadoId: number,
    @Body() dto: UpdateTurnoDto,
    @Request() req
  ) {
    return this.turnosService.updateByEmpleado(empleadoId, dto, req.user.id);
  }

  // ✅ Desactivar (soft delete) todos los turnos de un empleado
  @Delete("empleado/:empleadoId")
  @RequirePermissions("turnos")
  @ApiOperation({ summary: "Desactivar (soft delete) todos los turnos de un empleado" })
  softDeleteByEmpleado(
    @Param("empleadoId", ParseIntPipe) empleadoId: number,
    @Request() req
  ) {
    return this.turnosService.softDeleteByEmpleado(empleadoId, req.user.id);
  }
}
