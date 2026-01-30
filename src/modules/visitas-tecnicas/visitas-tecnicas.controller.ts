import { Controller, Get, Post, Patch, Body, Param, UseGuards, ParseIntPipe, Query } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { VisitasTecnicasService } from "./visitas-tecnicas.service";
import { CreateVisitaTecnicaDto, UpdateVisitaTecnicaDto } from "./dto/visita-tecnica.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";

@ApiTags("Visitas Técnicas / Supervisión")
@Controller("visitas-tecnicas")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class VisitasTecnicasController {
    constructor(private readonly visitasService: VisitasTecnicasService) { }

    @Get()
    @RequirePermissions("visitas")
    @ApiOperation({ summary: "Listar visitas técnicas y de supervisión" })
    @ApiQuery({ name: "puesto_id", required: false, type: Number })
    @ApiQuery({ name: "tipo_visitante", required: false })
    @ApiQuery({ name: "fecha_desde", required: false })
    async findAll(
        @Query("puesto_id") puesto_id?: string,
        @Query("tipo_visitante") tipo_visitante?: string,
        @Query("fecha_desde") fecha_desde?: string
    ) {
        const filters: any = {};
        if (puesto_id) filters.puesto_id = parseInt(puesto_id);
        if (tipo_visitante) filters.tipo_visitante = tipo_visitante;
        if (fecha_desde) filters.fecha_desde = fecha_desde;

        return this.visitasService.findAll(filters);
    }

    @Get(":id")
    @RequirePermissions("visitas")
    @ApiOperation({ summary: "Obtener visita técnica por ID" })
    async findOne(@Param("id", ParseIntPipe) id: number) {
        return this.visitasService.findOne(id);
    }

    @Post()
    @RequirePermissions("visitas", "crear")
    @ApiOperation({ summary: "Registrar llegada de visita técnica/supervisión" })
    async create(@Body() createDto: CreateVisitaTecnicaDto, @CurrentUser() user: any) {
        return this.visitasService.create(createDto, user.id);
    }

    @Patch(":id/salida")
    @RequirePermissions("visitas", "actualizar")
    @ApiOperation({ summary: "Registrar salida y resultados" })
    async registrarSalida(
        @Param("id", ParseIntPipe) id: number,
        @Body() updateDto: UpdateVisitaTecnicaDto
    ) {
        return this.visitasService.registrarSalida(id, updateDto);
    }

    @Post(":id/evidencia")
    @RequirePermissions("visitas", "actualizar")
    @ApiOperation({ summary: "Subir URL de evidencia fotográfica" })
    async subirEvidencia(
        @Param("id", ParseIntPipe) id: number,
        @Body("url") url: string
    ) {
        return this.visitasService.subirEvidencia(id, url);
    }

    @Get("reportes/general")
    @RequirePermissions("visitas", "ver_admin")
    @ApiOperation({ summary: "Reportes visitas técnicas" })
    async getReportes() {
        return this.visitasService.getReportes({});
    }
}
