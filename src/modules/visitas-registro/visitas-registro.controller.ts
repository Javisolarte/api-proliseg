import { Controller, Get, Post, Patch, Body, Param, UseGuards, ParseIntPipe, Query } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { VisitasRegistroService } from "./visitas-registro.service";
import { CreateVisitaRegistroDto, RegistrarSalidaDto } from "./dto/visita.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";

@ApiTags("Visitas - Registro")
@Controller("visitas-registro")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class VisitasRegistroController {
    constructor(private readonly visitasService: VisitasRegistroService) { }

    @Get()
    @RequirePermissions("visitas")
    @ApiOperation({ summary: "Listar historial de visitas" })
    @ApiQuery({ name: "puesto_id", required: false })
    @ApiQuery({ name: "estado", required: false })
    @ApiQuery({ name: "residente_id", required: false })
    @ApiQuery({ name: "visitante_id", required: false })
    async findAll(
        @Query("puesto_id") puesto_id?: string,
        @Query("estado") estado?: string,
        @Query("residente_id") residente_id?: string,
        @Query("visitante_id") visitante_id?: string
    ) {
        const filters: any = {};
        if (puesto_id) filters.puesto_id = parseInt(puesto_id);
        if (estado) filters.estado = estado;
        if (residente_id) filters.residente_id = parseInt(residente_id);
        if (visitante_id) filters.visitante_id = parseInt(visitante_id);

        return this.visitasService.findAll(filters);
    }

    @Post()
    @RequirePermissions("visitas", "crear")
    @ApiOperation({ summary: "Registrar entrada de visita" })
    @ApiResponse({ status: 201, description: "Visita registrada" })
    async create(@Body() createDto: CreateVisitaRegistroDto, @CurrentUser() user: any) {
        return this.visitasService.create(createDto, user.id);
    }

    @Patch(":id/salida")
    @RequirePermissions("visitas", "actualizar")
    @ApiOperation({ summary: "Registrar salida de visita" })
    @ApiResponse({ status: 200, description: "Salida registrada" })
    async registrarSalida(
        @Param("id", ParseIntPipe) id: number,
        @Body() dto: RegistrarSalidaDto,
        @CurrentUser() user: any
    ) {
        return this.visitasService.registrarSalida(id, user.id, dto);
    }

    @Get("activas/puesto/:puestoId")
    @RequirePermissions("visitas")
    @ApiOperation({ summary: "Obtener visitas activas de un puesto" })
    @ApiResponse({ status: 200, description: "Lista de visitas activas" })
    async getVisitasActivas(@Param("puestoId", ParseIntPipe) puestoId: number) {
        return this.visitasService.getVisitasActivas(puestoId);
    }

    @Get("reportes/general")
    @RequirePermissions("visitas", "ver_admin")
    @ApiOperation({ summary: "Reporte general de visitas" })
    @ApiQuery({ name: "desde", required: false })
    @ApiQuery({ name: "hasta", required: false })
    async getReportes(@Query() filtros: any) {
        return this.visitasService.getReportesVisitas(filtros);
    }
}
