import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { AsistenciasService } from "./asistencias.service";
import { RegistrarEntradaDto } from "./dto/registrar_entrada.dto";
import { RegistrarSalidaDto } from "./dto/registrar_salida.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";

@ApiTags("Asistencias")
@Controller("asistencias")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class AsistenciasController {
  constructor(private readonly asistenciasService: AsistenciasService) {}

  @Post("entrada")
  @RequirePermissions("asistencia.write")
  @ApiOperation({ summary: "Registrar entrada con geolocalización" })
  @ApiResponse({
    status: 201,
    description: "Entrada registrada exitosamente",
  })
  async registrarEntrada(@Body() dto: RegistrarEntradaDto) {
    return this.asistenciasService.registrarEntrada(dto);
  }

  @Post("salida")
  @RequirePermissions("asistencia.write")
  @ApiOperation({ summary: "Registrar salida con geolocalización" })
  @ApiResponse({
    status: 201,
    description: "Salida registrada exitosamente",
  })
  async registrarSalida(@Body() dto: RegistrarSalidaDto) {
    return this.asistenciasService.registrarSalida(dto);
  }

  @Get("metricas")
  @RequirePermissions("asistencia.read")
  @ApiOperation({ summary: "Obtener métricas de cumplimiento" })
  @ApiResponse({ status: 200, description: "Métricas de cumplimiento" })
  async obtenerMetricaCumplimiento() {
    return this.asistenciasService.obtenerMetricaCumplimiento();
  }
}
