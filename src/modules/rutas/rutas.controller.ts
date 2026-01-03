import { Controller, Get, Post, Body, Query, UseGuards, Param, Put, Delete } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { RutasService } from "./rutas.service";
import {
    CreateRutaGpsDto, CreateRecorridoSupervisorDto, CreateRondaRonderoDto,
    CreateRutaSupervisionDto, UpdateRutaSupervisionDto, CreateRutaPuntoDto,
    CreateRutaAsignacionDto, CreateRutaEjecucionDto, FinalizarRutaEjecucionDto, CreateRutaEventoDto
} from "./dto/ruta.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";

@ApiTags("Rutas y Recorridos")
@Controller("rutas")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class RutasController {
    constructor(private readonly rutasService: RutasService) { }

    // ==========================================
    // 1. PLANIFICACIÓN (Rutas Sugeridas)
    // ==========================================
    @Get()
    @RequirePermissions("rutas")
    @ApiOperation({ summary: "Listar todas las rutas de supervisión" })
    async findAllRutas() {
        return this.rutasService.findAllRutas();
    }

    @Get(":id")
    @RequirePermissions("rutas")
    @ApiOperation({ summary: "Obtener detalle de ruta" })
    async findOneRuta(@Param("id") id: string) {
        return this.rutasService.findOneRuta(+id);
    }

    @Post()
    @RequirePermissions("rutas")
    @ApiOperation({ summary: "Crear nueva ruta de supervisión" })
    async createRuta(@Body() dto: CreateRutaSupervisionDto) {
        return this.rutasService.createRuta(dto);
    }

    @Put(":id")
    @RequirePermissions("rutas")
    @ApiOperation({ summary: "Actualizar ruta" })
    async updateRuta(@Param("id") id: string, @Body() dto: UpdateRutaSupervisionDto) {
        return this.rutasService.updateRuta(+id, dto);
    }

    @Delete(":id")
    @RequirePermissions("rutas")
    @ApiOperation({ summary: "Eliminar ruta" })
    async deleteRuta(@Param("id") id: string) {
        return this.rutasService.deleteRuta(+id);
    }

    // Puntos
    @Post(":id/puestos")
    @RequirePermissions("rutas")
    @ApiOperation({ summary: "Agregar puesto (punto) a una ruta" })
    async addPunto(@Param("id") id: string, @Body() dto: CreateRutaPuntoDto) {
        return this.rutasService.addPunto(+id, dto);
    }

    @Delete(":id/puestos/:punto_id")
    @RequirePermissions("rutas")
    @ApiOperation({ summary: "Eliminar punto de ruta" })
    async deletePunto(@Param("punto_id") puntoId: string) {
        return this.rutasService.deletePunto(+puntoId);
    }

    // ==========================================
    // 2. ASIGNACIÓN
    // ==========================================
    // NOTA: 'rutas-asignacion' está en otro path prefix si sigo la convencion de Nest o sub-ruta aqui.
    // El user request -> /api/rutas-asignacion.
    // Para simplificar, haré un controller separado 'RutasAsignacionController' abajo, pero aqui registro rutas basicas.
    // O puedo usar @Post('asignacion') -> /api/rutas/asignacion.
    // El request pedia: /api/rutas-asignacion.
    // Voy a crear un SEGUNDO controller en este mismo archivo.

    // ==========================================
    // 3. LEGACY ENDPOINTS (Mantener compatibilidad)
    // ==========================================
    @Post("gps")
    @RequirePermissions("rutas")
    @ApiOperation({ summary: "Registrar punto GPS (Legacy)" })
    async createRutaGps(@Body() createDto: CreateRutaGpsDto) {
        return this.rutasService.createRutaGps(createDto);
    }

    @Get("gps")
    @RequirePermissions("rutas")
    @ApiOperation({ summary: "Obtener historial GPS (Legacy)" })
    @ApiQuery({ name: "empleadoId", required: false })
    async getRutasGps(@Query("empleadoId") empleadoId?: number) {
        return this.rutasService.getRutasGps(empleadoId);
    }

    @Post("recorridos")
    @RequirePermissions("rutas")
    @ApiOperation({ summary: "Registrar recorrido (Legacy)" })
    async createRecorrido(@Body() createDto: CreateRecorridoSupervisorDto) {
        return this.rutasService.createRecorrido(createDto);
    }

    @Get("recorridos")
    @RequirePermissions("rutas")
    @ApiOperation({ summary: "Obtener recorridos (Legacy)" })
    @ApiQuery({ name: "supervisorId", required: false })
    async getRecorridos(@Query("supervisorId") supervisorId?: number) {
        return this.rutasService.getRecorridos(supervisorId);
    }

    @Post("rondas")
    @RequirePermissions("rutas")
    @ApiOperation({ summary: "Registrar ronda (Legacy)" })
    async createRonda(@Body() createDto: CreateRondaRonderoDto) {
        return this.rutasService.createRonda(createDto);
    }

    @Get("rondas")
    @RequirePermissions("rutas")
    @ApiOperation({ summary: "Obtener rondas (Legacy)" })
    @ApiQuery({ name: "ronderoId", required: false })
    async getRondas(@Query("ronderoId") ronderoId?: number) {
        return this.rutasService.getRondas(ronderoId);
    }
}

// --------------------------------------------------------
// CONTROLLERS ADICIONALES PARA CUMPLIR RUTAS ESPECIFICAS
// --------------------------------------------------------

@ApiTags("Rutas - Asignación")
@Controller("rutas-asignacion")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class RutasAsignacionController {
    constructor(private readonly rutasService: RutasService) { }

    @Post()
    @ApiOperation({ summary: "Asignar ruta a turno" })
    asignar(@Body() dto: CreateRutaAsignacionDto) {
        return this.rutasService.asignarRuta(dto);
    }

    @Get("turno/:turno_id")
    @ApiOperation({ summary: "Obtener ruta asignada al turno" })
    getByTurno(@Param("turno_id") turnoId: string) {
        return this.rutasService.getAsignacionPorTurno(+turnoId);
    }

    @Delete(":id")
    @ApiOperation({ summary: "Eliminar asignación" })
    delete(@Param("id") id: string) {
        return this.rutasService.deleteAsignacion(+id);
    }
}

@ApiTags("Rutas - Ejecución")
@Controller("rutas-ejecucion")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class RutasEjecucionController {
    constructor(private readonly rutasService: RutasService) { }

    @Post("iniciar")
    @ApiOperation({ summary: "Iniciar ejecución de ruta" })
    iniciar(@Body() dto: CreateRutaEjecucionDto) {
        return this.rutasService.iniciarEjecucion(dto);
    }

    @Post("finalizar")
    @ApiOperation({ summary: "Finalizar ejecución de ruta" })
    finalizar(@Body() dto: FinalizarRutaEjecucionDto) {
        return this.rutasService.finalizarEjecucion(dto);
    }

    @Get(":id")
    @ApiOperation({ summary: "Obtener detalle de ejecución" })
    getOne(@Param("id") id: string) {
        return this.rutasService.getEjecucion(+id);
    }

    @Get("turno/:turno_id")
    @ApiOperation({ summary: "Obtener ejecución por turno" })
    getByTurno(@Param("turno_id") turnoId: string) {
        return this.rutasService.getEjecucionPorTurno(+turnoId);
    }

    @Get("supervisor/:empleado_id")
    @ApiOperation({ summary: "Historial de ejecuciones por supervisor" })
    getBySupervisor(@Param("empleado_id") id: string) {
        return this.rutasService.getEjecucionPorSupervisor(+id);
    }
}

@ApiTags("Rutas - Eventos")
@Controller("rutas-eventos")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class RutasEventosController {
    constructor(private readonly rutasService: RutasService) { }

    @Post()
    @ApiOperation({ summary: "Registrar evento (GPS o Incidencia)" })
    registrar(@Body() dto: CreateRutaEventoDto) {
        return this.rutasService.registrarEvento(dto);
    }

    @Get("ejecucion/:ejecucion_id")
    @ApiOperation({ summary: "Obtener eventos de una ejecución" })
    getByEjecucion(@Param("ejecucion_id") id: string) {
        return this.rutasService.getEventos(+id);
    }

    @Get("mapa/:ejecucion_id")
    @ApiOperation({ summary: "Obtener data para mapa" })
    getMapa(@Param("ejecucion_id") id: string) {
        return this.rutasService.getMapa(+id);
    }
}
