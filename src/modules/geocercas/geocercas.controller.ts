import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    UseGuards,
    ParseIntPipe,
} from "@nestjs/common";
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
} from "@nestjs/swagger";
import { GeocercasService } from "./geocercas.service";
import { CreateGeocercaDto, UpdateGeocercaDto, EvaluarGPSDto, CreateGeocercaVerticesDto } from "./dto/geocercas.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";

@ApiTags("Geocercas")
@Controller("api")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class GeocercasController {
    constructor(private readonly geocercasService: GeocercasService) { }

    /**
     * 📍 Gestión de geocercas
     */
    @Post("geocercas")
    @RequirePermissions("puestos")
    @ApiOperation({ summary: "Crear una nueva geocerca" })
    async create(@Body() dto: CreateGeocercaDto) {
        return this.geocercasService.create(dto);
    }

    @Get("geocercas")
    @RequirePermissions("puestos")
    @ApiOperation({ summary: "Listar todas las geocercas" })
    async findAll() {
        return this.geocercasService.findAll();
    }

    @Get("geocercas/:id")
    @RequirePermissions("puestos")
    @ApiOperation({ summary: "Obtener geocerca por ID" })
    async findOne(@Param("id", ParseIntPipe) id: number) {
        return this.geocercasService.findOne(id);
    }

    @Get("geocercas/:id/detalle")
    @RequirePermissions("puestos")
    @ApiOperation({ summary: "Obtener detalle completo de geocerca (geometría)" })
    async getDetalle(@Param("id", ParseIntPipe) id: number) {
        return this.geocercasService.getDetalle(id);
    }

    @Put("geocercas/:id")
    @RequirePermissions("puestos")
    @ApiOperation({ summary: "Actualizar geocerca" })
    async update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateGeocercaDto) {
        return this.geocercasService.update(id, dto);
    }

    @Delete("geocercas/:id")
    @RequirePermissions("puestos")
    @ApiOperation({ summary: "Eliminar geocerca" })
    async remove(@Param("id", ParseIntPipe) id: number) {
        return this.geocercasService.remove(id);
    }

    /**
     * 🔗 Asociaciones Puestos
     */
    @Post("geocercas/:id/puestos")
    @RequirePermissions("puestos")
    @ApiOperation({ summary: "Asociar geocerca a un puesto" })
    async asociarPuesto(
        @Param("id", ParseIntPipe) id: number,
        @Body("puesto_id", ParseIntPipe) puestoId: number
    ) {
        return this.geocercasService.asociarPuesto(id, puestoId);
    }

    @Delete("geocercas/:id/puestos/:puestoId")
    @RequirePermissions("puestos")
    @ApiOperation({ summary: "Desasociar geocerca de un puesto" })
    async desasociarPuesto(
        @Param("id", ParseIntPipe) id: number,
        @Param("puestoId", ParseIntPipe) puestoId: number
    ) {
        return this.geocercasService.desasociarPuesto(id, puestoId);
    }

    /**
     * 🔗 Asociaciones Ruta Puntos
     */
    @Post("geocercas/:id/ruta-puntos")
    @RequirePermissions("puestos")
    @ApiOperation({ summary: "Asociar geocerca a un punto de ruta" })
    async asociarRutaPunto(
        @Param("id", ParseIntPipe) id: number,
        @Body("ruta_punto_id", ParseIntPipe) rutaPuntoId: number
    ) {
        return this.geocercasService.asociarRutaPunto(id, rutaPuntoId);
    }

    @Delete("geocercas/:id/ruta-puntos/:rutaPuntoId")
    @RequirePermissions("puestos")
    @ApiOperation({ summary: "Desasociar geocerca de un punto de ruta" })
    async desasociarRutaPunto(
        @Param("id", ParseIntPipe) id: number,
        @Param("rutaPuntoId", ParseIntPipe) rutaPuntoId: number
    ) {
        return this.geocercasService.desasociarRutaPunto(id, rutaPuntoId);
    }

    /**
     * 📍 Gestión de Vértices
     */
    @Post("geocercas/:id/vertices")
    @RequirePermissions("puestos")
    @ApiOperation({ summary: "Agregar vértices a una geocerca" })
    async addVertices(
        @Param("id", ParseIntPipe) id: number,
        @Body() dto: CreateGeocercaVerticesDto
    ) {
        return this.geocercasService.addVertices(id, dto);
    }

    @Put("geocercas/:id/vertices")
    @RequirePermissions("puestos")
    @ApiOperation({ summary: "Reemplazar vértices de una geocerca" })
    async replaceVertices(
        @Param("id", ParseIntPipe) id: number,
        @Body() dto: CreateGeocercaVerticesDto
    ) {
        return this.geocercasService.replaceVertices(id, dto);
    }

    @Get("geocercas/:id/vertices")
    @RequirePermissions("puestos")
    @ApiOperation({ summary: "Listar vértices de una geocerca" })
    async getVertices(@Param("id", ParseIntPipe) id: number) {
        return this.geocercasService.getVertices(id);
    }

    @Delete("geocercas/:geocercaId/vertices/:verticeId")
    @RequirePermissions("puestos")
    @ApiOperation({ summary: "Eliminar un vértice específico" })
    async removeVertice(@Param("verticeId", ParseIntPipe) verticeId: number) {
        return this.geocercasService.removeVertice(verticeId);
    }

    /**
     * 📡 Evaluación GPS
     */
    @Post("geocercas/evaluar")
    @ApiOperation({ summary: "Evaluar coordenadas GPS con geocercas" })
    @ApiResponse({ status: 200, description: "Eventos de entrada/salida disparados" })
    async evaluar(@Body() dto: EvaluarGPSDto) {
        return this.geocercasService.evaluar(dto);
    }

    /**
     * 📋 Eventos
     */
    @Get("geocercas/:id/eventos")
    @RequirePermissions("puestos")
    @ApiOperation({ summary: "Obtener historial de eventos de una geocerca" })
    async getEventosGeocerca(@Param("id", ParseIntPipe) id: number) {
        return this.geocercasService.getEventosGeocerca(id);
    }

    @Get("empleados/:id/geocercas/eventos")
    @RequirePermissions("puestos") // El usuario dijo "el permiso de geocerca seria el mismo de puestos"
    @ApiOperation({ summary: "Obtener historial de eventos de geocercas para un empleado" })
    async getEventosEmpleado(@Param("id", ParseIntPipe) id: number) {
        return this.geocercasService.getEventosEmpleado(id);
    }
}
