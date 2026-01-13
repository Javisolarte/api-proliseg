import { Controller, Get, Post, Body, Query, UseGuards, Param, Put, Delete } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { RutasService } from "./rutas.service";
import {
    CreateRutaGpsDto, CreateRecorridoSupervisorDto, CreateRondaRonderoDto,
    CreateRutaSupervisionDto, UpdateRutaSupervisionDto, CreateRutaPuntoDto,
    CreateRutaAsignacionDto, CreateRutaEjecucionDto, FinalizarRutaEjecucionDto, CreateRutaEventoDto,
    AsignarRutasPorFechaDto, AsignarRutaManualDto, ConsultarAsignacionesDto
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

    // ==========================================
    // ASIGNACIÓN AUTO MÁTICA (NUEVOS ENDPOINTS)
    // ==========================================

    @Post("automatica")
    @RequirePermissions("rutas")
    @ApiOperation({
        summary: "Asignar rutas automáticamente a supervisores por fecha",
        description: `
            Procesa todos los turnos de supervisores en la fecha especificada y asigna rutas automáticamente según el tipo_turno.
            
            **Lógica**:
            1. Busca todos los turnos de supervisores para la fecha
            2. Por cada turno, busca la ruta según tipo_turno (diurno → RUTA DÍA, nocturno → RUTA NOCHE)
            3. Asigna el vehículo del supervisor automáticamente
            4. Retorna resumen detallado con éxitos y errores
            
            **Casos especiales**:
            - Si el supervisor no tiene vehículo, asigna la ruta sin vehículo
            - Si ya existe asignación, la omite (a menos que forzar_reasignacion=true)
            - Si no hay ruta para el tipo_turno, lo reporta como error
        `
    })
    @ApiQuery({
        name: "fecha",
        required: true,
        example: "2026-01-15",
        description: "Fecha para procesar asignaciones (formato YYYY-MM-DD)"
    })
    @ApiQuery({
        name: "forzar_reasignacion",
        required: false,
        type: Boolean,
        example: false,
        description: "Si es true, reemplaza asignaciones existentes"
    })
    @ApiResponse({
        status: 200,
        description: "Resumen de asignaciones procesadas",
        schema: {
            example: {
                fecha: "2026-01-15",
                total_turnos_procesados: 10,
                total_asignaciones_exitosas: 8,
                total_errores: 2,
                asignaciones_exitosas: [
                    {
                        turno_id: 100,
                        empleado_id: 5,
                        empleado_nombre: "JUAN PEREZ",
                        tipo_turno: "diurno",
                        ruta_id: 1,
                        ruta_nombre: "RUTA DIA",
                        vehiculo_id: 2,
                        vehiculo_placa: "ABC123",
                        asignado: true,
                        mensaje: "Ruta asignada correctamente"
                    }
                ],
                errores: [
                    {
                        turno_id: 101,
                        empleado_id: 6,
                        empleado_nombre: "MARIA GOMEZ",
                        tipo_turno: "nocturno",
                        asignado: false,
                        mensaje: "No se encontró ruta activa para tipo_turno: nocturno"
                    }
                ]
            }
        }
    })
    asignarPorFecha(@Query() dto: AsignarRutasPorFechaDto) {
        return this.rutasService.asignarRutasPorFecha(dto);
    }

    @Post("manual")
    @RequirePermissions("rutas")
    @ApiOperation({
        summary: "Asignar ruta manualmente a un turno específico",
        description: `
            Asigna una ruta a un turno de supervisor de forma manual.
            
            **Parámetros opcionales**:
            - Si no se envía ruta_id, busca la ruta según el tipo_turno del turno
            - Si no se envía vehiculo_id, busca el vehículo asignado al supervisor
            
            **Validaciones**:
            - El turno debe existir
            - El empleado del turno debe tener rol "supervisor"
            - No debe existir una asignación activa previa (de lo contrario, eliminarla primero)
        `
    })
    @ApiResponse({
        status: 200,
        description: "Resultado de la asignación",
        schema: {
            example: {
                turno_id: 100,
                empleado_id: 5,
                empleado_nombre: "JUAN PEREZ",
                tipo_turno: "diurno",
                ruta_id: 1,
                ruta_nombre: "RUTA DIA",
                vehiculo_id: 2,
                vehiculo_placa: "ABC123",
                asignado: true,
                mensaje: "Ruta asignada correctamente"
            }
        }
    })
    asignarManual(@Body() dto: AsignarRutaManualDto) {
        return this.rutasService.asignarRutaManual(dto);
    }

    @Get("consultar")
    @RequirePermissions("rutas")
    @ApiOperation({
        summary: "Consultar asignaciones de rutas con filtros",
        description: `
            Permite consultar asignaciones de rutas con filtros opcionales.
            
            **Filtros disponibles**:
            - fecha: Filtra por fecha del turno
            - supervisor_id: Filtra por supervisor específico
            - solo_activas: true (default) solo activas, false incluye desactivadas
        `
    })
    @ApiQuery({ name: "fecha", required: false, example: "2026-01-15" })
    @ApiQuery({ name: "supervisor_id", required: false, type: Number })
    @ApiQuery({ name: "solo_activas", required: false, type: Boolean, example: true })
    consultarAsignaciones(@Query() dto: ConsultarAsignacionesDto) {
        return this.rutasService.consultarAsignaciones(dto);
    }

    @Delete("desactivar/:id")
    @RequirePermissions("rutas")
    @ApiOperation({
        summary: "Desactivar asignación de ruta",
        description: "Marca la asignación como inactiva (no la elimina de la base de datos)"
    })
    desactivarAsignacion(@Param("id") id: string) {
        return this.rutasService.desactivarAsignacion(+id);
    }

    // ==========================================
    // ENDPOINTS EXISTENTES (Compatibilidad)
    // ==========================================

    @Post()
    @RequirePermissions("rutas")
    @ApiOperation({ summary: "Asignar ruta a turno (método legacy/manual directo)" })
    asignar(@Body() dto: CreateRutaAsignacionDto) {
        return this.rutasService.asignarRuta(dto);
    }

    @Get("turno/:turno_id")
    @RequirePermissions("rutas")
    @ApiOperation({ summary: "Obtener ruta asignada al turno" })
    getByTurno(@Param("turno_id") turnoId: string) {
        return this.rutasService.getAsignacionPorTurno(+turnoId);
    }

    @Delete(":id")
    @RequirePermissions("rutas")
    @ApiOperation({ summary: "Eliminar asignación (hard delete)" })
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
