import { Controller, Get, Post, Patch, Body, Param, UseGuards, ParseIntPipe, Query } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { RondasEjecucionService } from "./rondas-ejecucion.service";
import { IniciarRondaDto, RegistrarPuntoDto, FinalizarRondaDto } from "./dto/ejecucion.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";

@ApiTags("Rondas - Ejecución")
@Controller("rondas-ejecucion")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class RondasEjecucionController {
    constructor(private readonly rondasService: RondasEjecucionService) { }

    @Get()
    @RequirePermissions("rondas")
    @ApiOperation({ summary: "Listar ejecuciones de rondas" })
    @ApiQuery({ name: "rondero_id", required: false, type: Number })
    @ApiQuery({ name: "estado", required: false })
    @ApiQuery({ name: "fecha_desde", required: false })
    async findAll(
        @Query("rondero_id") rondero_id?: string,
        @Query("estado") estado?: string,
        @Query("fecha_desde") fecha_desde?: string
    ) {
        const filters: any = {};
        if (rondero_id) filters.rondero_id = parseInt(rondero_id);
        if (estado) filters.estado = estado;
        if (fecha_desde) filters.fecha_desde = fecha_desde;

        return this.rondasService.findAll(filters);
    }

    @Post("iniciar")
    @RequirePermissions("rondas", "crear")
    @ApiOperation({ summary: "Iniciar ejecución de ronda" })
    async iniciarRonda(@Body() dto: IniciarRondaDto, @CurrentUser() user: any) {
        return this.rondasService.iniciarRonda(dto, user.empleado_id || user.id);
    }

    @Post("puntos")
    @RequirePermissions("rondas", "crear")
    @ApiOperation({ summary: "Registrar punto de ronda" })
    async registrarPunto(@Body() dto: RegistrarPuntoDto) {
        return this.rondasService.registrarPunto(dto);
    }

    @Patch(":id/finalizar")
    @RequirePermissions("rondas", "actualizar")
    @ApiOperation({ summary: "Finalizar ronda" })
    async finalizarRonda(
        @Param("id", ParseIntPipe) id: number,
        @Body() dto: FinalizarRondaDto
    ) {
        return this.rondasService.finalizarRonda(id, dto);
    }

    @Get(":id/progreso")
    @RequirePermissions("rondas")
    @ApiOperation({ summary: "Obtener progreso de ronda en ejecución" })
    async getProgreso(@Param("id", ParseIntPipe) id: number) {
        return this.rondasService.getProgreso(id);
    }

    @Get("reportes/incumplidas")
    @RequirePermissions("rondas", "ver_admin")
    @ApiOperation({ summary: "Listar rondas incumplidas o fallidas" })
    async getIncumplidas() {
        return this.rondasService.getIncumplidas();
    }

    @Get("reportes/general")
    @RequirePermissions("rondas", "ver_admin")
    @ApiOperation({ summary: "Reporte general de ejecución de rondas" })
    @ApiQuery({ name: "desde", required: false })
    @ApiQuery({ name: "hasta", required: false })
    async getReportes(
        @Query("desde") desde?: string,
        @Query("hasta") hasta?: string
    ) {
        return this.rondasService.getReportes({ desde, hasta });
    }
}
