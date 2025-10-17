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
} from "@nestjs/common";
import { TurnosConfiguracionService } from "./turnos_configuracion.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import {
  CreateTurnoConfiguracionDto,
  UpdateTurnoConfiguracionDto,
} from "./dto/turno_configuracion.dto";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";

@ApiTags("Turnos Configuración")
@Controller("turnos-configuracion")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class TurnosConfiguracionController {
  constructor(private readonly turnosService: TurnosConfiguracionService) {}

  @Get()
  @RequirePermissions("turnos")
  @ApiOperation({ summary: "Listar todas las configuraciones de turnos" })
  findAll() {
    return this.turnosService.findAll();
  }

  @Get(":id")
  @RequirePermissions("turnos_configuracion")
  @ApiOperation({ summary: "Obtener una configuración de turno por ID" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.turnosService.findOne(id);
  }

  @Post()
  @RequirePermissions("turnos_configuracion")
  @ApiOperation({ summary: "Crear una nueva configuración de turno" })
  create(@Body() dto: CreateTurnoConfiguracionDto, @Request() req) {
    return this.turnosService.create(dto, req.user.id);
  }

  @Put(":id")
  @RequirePermissions("turnos_configuracion")
  @ApiOperation({ summary: "Actualizar configuración de turno" })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateTurnoConfiguracionDto,
    @Request() req
  ) {
    return this.turnosService.update(id, dto, req.user.id);
  }

  @Delete(":id")
  @RequirePermissions("turnos_configuracion")
  @ApiOperation({ summary: "Eliminar (soft delete) configuración de turno" })
  softDelete(@Param("id", ParseIntPipe) id: number, @Request() req) {
    return this.turnosService.softDelete(id, req.user.id);
  }
}
