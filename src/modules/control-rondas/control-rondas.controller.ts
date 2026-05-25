import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { ControlRondasService } from "./control-rondas.service";
import {
  BulkPuntosControlDto,
  FinalizarRondaControlDto,
  IniciarRondaControlDto,
  RegistrarLecturaControlDto,
  UpsertConfiguracionRondaDto,
  UpsertPuntoControlDto,
} from "./dto/control-rondas.dto";

@ApiTags("Control de Rondas")
@Controller("control-rondas")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class ControlRondasController {
  constructor(private readonly service: ControlRondasService) {}

  @Get("dashboard")
  @RequirePermissions("rondas")
  @ApiOperation({ summary: "Dashboard de puestos con control de rondas" })
  dashboard() {
    return this.service.dashboard();
  }

  @Get("tracking/en-curso")
  @RequirePermissions("rondas")
  @ApiOperation({ summary: "Rondas en curso con último GPS para mapa operativo" })
  getEnCurso() {
    return this.service.getEnCurso();
  }

  @Get("puestos/:puestoId")
  @RequirePermissions("rondas")
  @ApiOperation({ summary: "Configuración, puntos y últimas rondas de un puesto" })
  getPuestoControl(@Param("puestoId", ParseIntPipe) puestoId: number) {
    return this.service.getPuestoControl(puestoId);
  }

  @Post("configuracion")
  @RequirePermissions("rondas", "crear")
  @ApiOperation({ summary: "Activar o actualizar control de rondas en un puesto" })
  upsertConfiguracion(@Body() dto: UpsertConfiguracionRondaDto, @CurrentUser() user: any) {
    return this.service.upsertConfiguracion(dto, user?.id);
  }

  @Post("configuracion/:configuracionId/puntos")
  @RequirePermissions("rondas", "crear")
  @ApiOperation({ summary: "Crear o actualizar un punto QR de control" })
  upsertPunto(
    @Param("configuracionId", ParseIntPipe) configuracionId: number,
    @Body() dto: UpsertPuntoControlDto,
  ) {
    return this.service.upsertPunto(configuracionId, dto);
  }

  @Post("configuracion/:configuracionId/puntos/bulk")
  @RequirePermissions("rondas", "crear")
  @ApiOperation({ summary: "Crear o actualizar varios puntos de control" })
  replacePuntos(
    @Param("configuracionId", ParseIntPipe) configuracionId: number,
    @Body() dto: BulkPuntosControlDto,
  ) {
    return this.service.replacePuntos(configuracionId, dto);
  }

  @Patch("puntos/:puntoId/rotar-qr")
  @RequirePermissions("rondas", "actualizar")
  @ApiOperation({ summary: "Rotar el secreto QR de un punto antifraude" })
  rotateQr(@Param("puntoId", ParseIntPipe) puntoId: number) {
    return this.service.rotateQr(puntoId);
  }

  @Post("ejecuciones/iniciar")
  @RequirePermissions("rondas", "crear")
  @ApiOperation({ summary: "Iniciar una ronda desde app móvil o web" })
  iniciar(@Body() dto: IniciarRondaControlDto, @CurrentUser() user: any) {
    return this.service.iniciar(dto, user);
  }

  @Post("ejecuciones/:ejecucionId/lecturas")
  @RequirePermissions("rondas", "crear")
  @ApiOperation({ summary: "Registrar lectura QR, GPS y evidencia de un punto" })
  registrarLectura(
    @Param("ejecucionId", ParseIntPipe) ejecucionId: number,
    @Body() dto: RegistrarLecturaControlDto,
    @CurrentUser() user: any,
  ) {
    return this.service.registrarLectura(ejecucionId, dto, user);
  }

  @Patch("ejecuciones/:ejecucionId/finalizar")
  @RequirePermissions("rondas", "actualizar")
  @ApiOperation({ summary: "Finalizar una ronda y calcular cumplimiento" })
  finalizar(@Param("ejecucionId", ParseIntPipe) ejecucionId: number, @Body() dto: FinalizarRondaControlDto) {
    return this.service.finalizar(ejecucionId, dto);
  }

  @Get("ejecuciones/:ejecucionId/tracking")
  @RequirePermissions("rondas")
  @ApiOperation({ summary: "Ver tracking completo de una ronda" })
  getTracking(@Param("ejecucionId", ParseIntPipe) ejecucionId: number) {
    return this.service.getTracking(ejecucionId);
  }
}
