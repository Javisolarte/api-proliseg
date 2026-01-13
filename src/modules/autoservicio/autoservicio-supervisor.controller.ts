import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AutoservicioService } from './autoservicio.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
    RegistrarMiAsistenciaEntradaDto,
    RegistrarMiAsistenciaSalidaDto
} from './dto/autoservicio-empleado.dto';
import {
    MiRutaAsignadaResponseDto,
    IniciarSupervisionDto,
    IniciarSupervisionResponseDto,
    RegistrarUbicacionDto as RegistrarUbicacionSupervisorDto,
    ValidarLlegadaPuestoDto,
    CrearMinutaRutaDto,
    FinalizarSupervisionDto,
    FinalizarSupervisionResponseDto,
    ConsultarHistorialDto,
    HistorialEjecucionDto,
    ReporteRutaDto,
    TipoChequeoDto,
    IniciarVisitaDto,
    FinalizarVisitaDto,
    RegistrarCheckeoDto,
    VehiculoAsignadoResponseDto,
    HeartbeatDto,
    SyncDataDto,
    PausarReanudarRutaDto,
    ReportarNovedadDto,
    ConfirmacionAckDto,
    DispositivoInfoDto,
    MisHorariosResponseDto,
    CargarEvidenciaDto
} from './dto/autoservicio-supervisor.dto';

@ApiTags('Autoservicio - Supervisor (Móvil)')
@Controller('supervisor') // Prefix changed to match request
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class AutoservicioSupervisorController {
    constructor(private readonly autoservicioService: AutoservicioService) { }

    // 1. Perfil Operativo del Supervisor
    @Get('perfil')
    @ApiOperation({ summary: 'Perfil Operativo del Supervisor' })
    getPerfil(@Request() req) {
        const userId = req.user.id;
        return this.autoservicioService.getPerfilSupervisor(userId);
    }

    // 2. Turno Activo
    @Get('turno-activo')
    @ApiOperation({ summary: 'Obtener Turno Activo del Supervisor' })
    getTurnoActivo(@Request() req) {
        const supervisorId = req.user.empleadoId;
        return this.autoservicioService.obtenerSupervisionActiva(supervisorId);
    }

    // 3. Ruta Actual del Turno
    @Get('ruta-actual')
    @ApiOperation({ summary: 'Obtener Ruta Actual del Turno' })
    getRutaActual(@Request() req) {
        const supervisorId = req.user.empleadoId;
        return this.autoservicioService.obtenerRutaAsignadaHoy(supervisorId);
    }

    // 4. Iniciar Ejecución de Ruta
    @Post('ruta/iniciar')
    @ApiOperation({ summary: 'Iniciar Ejecución de Ruta' })
    iniciarRuta(@Body() dto: IniciarSupervisionDto, @Request() req) {
        const supervisorId = req.user.empleadoId;
        return this.autoservicioService.iniciarSupervision(dto, supervisorId);
    }

    // 5. Finalizar Ejecución de Ruta
    @Post('ruta/finalizar')
    @ApiOperation({ summary: 'Finalizar Ejecución de Ruta' })
    finalizarRuta(@Body() dto: FinalizarSupervisionDto, @Request() req) {
        const supervisorId = req.user.empleadoId;
        return this.autoservicioService.finalizarSupervision(dto, supervisorId);
    }

    // 6. Registrar GPS (Tracking)
    @Post('gps')
    @ApiOperation({ summary: 'Registrar GPS (Tracking)' })
    registrarGps(@Body() dto: RegistrarUbicacionSupervisorDto, @Request() req) {
        const supervisorId = req.user.empleadoId;
        return this.autoservicioService.registrarUbicacion(dto, supervisorId);
    }

    // 7. Ubicación Actual
    @Get('ubicacion-actual')
    @ApiOperation({ summary: 'Obtener mi Ubicación Actual' })
    getUbicacionActual(@Request() req) {
        const supervisorId = req.user.empleadoId;
        return this.autoservicioService.getUltimaUbicacion(supervisorId);
    }

    // 8. Ubicaciones Activas (Central)
    @Get('ubicaciones-activas')
    @ApiOperation({ summary: 'Ubicaciones Activas de otros supervisores (Central)' })
    getUbicacionesActivas() {
        return this.autoservicioService.getUbicacionesActivasSupervisores();
    }

    // 9. Iniciar Visita a Puesto
    @Post('visitas/iniciar')
    @ApiOperation({ summary: 'Iniciar Visita a Puesto' })
    iniciarVisita(@Body() dto: IniciarVisitaDto, @Request() req) {
        const supervisorId = req.user.empleadoId;
        return this.autoservicioService.iniciarVisitaPuesto(dto, supervisorId);
    }

    // 10. Finalizar Visita a Puesto
    @Post('visitas/finalizar')
    @ApiOperation({ summary: 'Finalizar Visita a Puesto' })
    finalizarVisita(@Body() dto: FinalizarVisitaDto, @Request() req) {
        const supervisorId = req.user.empleadoId;
        return this.autoservicioService.finalizarVisitaPuesto(dto, supervisorId);
    }

    // 11. Checkeos Pendientes
    @Get('checkeos/pendientes')
    @ApiOperation({ summary: 'Consultar Checkeos Pendientes en la ruta' })
    getCheckeosPendientes(@Query('ejecucion_id') ejecucionId: number) {
        return this.autoservicioService.getPuntosPendientes(ejecucionId);
    }

    // 12. Registrar Checkeo
    @Post('checkeos')
    @ApiOperation({ summary: 'Registrar Checkeo Operativo' })
    registrarCheckeo(@Body() dto: RegistrarCheckeoDto, @Request() req) {
        const supervisorId = req.user.empleadoId;
        return this.autoservicioService.registrarCheckeo(dto, supervisorId);
    }

    // 13. Minutas Pendientes
    @Get('minutas/pendientes')
    @ApiOperation({ summary: 'Consultar Minutas Pendientes' })
    getMinutasPendientes(@Query('ejecucion_id') ejecucionId: number) {
        return this.autoservicioService.getMinutasPendientes(ejecucionId);
    }

    // 14. Registrar Minuta
    @Post('minutas')
    @ApiOperation({ summary: 'Registrar Minuta de Puesto' })
    registrarMinuta(@Body() dto: CrearMinutaRutaDto, @Request() req) {
        const supervisorId = req.user.empleadoId;
        return this.autoservicioService.crearMinutaRuta(dto, supervisorId);
    }

    // 15. Cargar Evidencia
    @Post('evidencias')
    @ApiOperation({ summary: 'Cargar Evidencia (Foto/Audio/Video)' })
    cargarEvidencia(@Body() dto: CargarEvidenciaDto) {
        return this.autoservicioService.cargarEvidencia(dto);
    }

    // 16. Vehículo Asignado
    @Get('vehiculo')
    @ApiOperation({ summary: 'Ver Vehículo Asignado al Turno' })
    getVehiculoAsignado(@Request() req) {
        const supervisorId = req.user.empleadoId;
        return this.autoservicioService.getVehiculoAsignadoHoy(supervisorId);
    }

    // --- NUEVOS ENDPOINTS AVANZADOS ---

    @Post('heartbeat')
    @ApiOperation({ summary: 'Mantiene viva la sesión y reporta estado del dispositivo' })
    heartbeat(@Body() dto: HeartbeatDto, @Request() req) {
        const supervisorId = req.user.empleadoId;
        return this.autoservicioService.registrarHeartbeat(dto, supervisorId);
    }

    @Post('sync')
    @ApiOperation({ summary: 'Sincronización masiva de datos offline' })
    sync(@Body() dto: SyncDataDto, @Request() req) {
        const supervisorId = req.user.empleadoId;
        return this.autoservicioService.sincronizarOffline(dto, supervisorId);
    }

    @Post('ruta/pausar')
    @ApiOperation({ summary: 'Pausar temporalmente la ruta' })
    pausarRuta(@Body() dto: PausarReanudarRutaDto, @Request() req) {
        const supervisorId = req.user.empleadoId;
        return this.autoservicioService.pausarRuta(dto, supervisorId);
    }

    @Post('ruta/reanudar')
    @ApiOperation({ summary: 'Reanudar ruta pausada' })
    reanudarRuta(@Body() dto: PausarReanudarRutaDto, @Request() req) {
        const supervisorId = req.user.empleadoId;
        return this.autoservicioService.reanudarRuta(dto, supervisorId);
    }

    @Post('novedades')
    @ApiOperation({ summary: 'Reportar novedad crítica inmediata' })
    reportarNovedad(@Body() dto: ReportarNovedadDto, @Request() req) {
        const supervisorId = req.user.empleadoId;
        return this.autoservicioService.reportarNovedadInmediata(dto, supervisorId);
    }

    @Get('geocerca/validar')
    @ApiOperation({ summary: 'Validar geocerca antes de visita' })
    validarGeocerca(
        @Query('puesto_id') puestoId: number,
        @Query('lat') lat: number,
        @Query('lng') lng: number
    ) {
        return this.autoservicioService.validarGeocercaPreVisita(puestoId, lat, lng);
    }

    @Get('ruta/detalle')
    @ApiOperation({ summary: 'Detalle completo de ruta para mapa' })
    getRutaDetalleMapa(@Query('ejecucion_id') ejecucionId: number) {
        return this.autoservicioService.getDetalleRutaMapa(ejecucionId);
    }

    @Post('ack')
    @ApiOperation({ summary: 'Confirmación de recepción de datos (ACK)' })
    confirmarRecepcion(@Body() dto: ConfirmacionAckDto) {
        return { status: 'confirmado', data: dto };
    }

    @Get('dispositivo')
    @ApiOperation({ summary: 'Ver información del dispositivo / Registrar dispositivo' })
    getDeviceInfo(@Request() req) {
        const supervisorId = req.user.empleadoId;
        return this.autoservicioService.getDispositivoInfo(supervisorId); // Nota: implementar getDispositivoInfo o registrar
    }

    @Post('dispositivo')
    @ApiOperation({ summary: 'Registrar información del dispositivo móvil' })
    registrarDispositivo(@Body() dto: DispositivoInfoDto, @Request() req) {
        const supervisorId = req.user.empleadoId;
        return this.autoservicioService.registrarDispositivo(dto, supervisorId);
    }

    @Get('mis-horarios')
    @ApiOperation({ summary: 'Consultar horarios y rutas asignadas (Calendario)' })
    getMisHorarios(@Request() req) {
        const supervisorId = req.user.empleadoId;
        return this.autoservicioService.getMisHorariosYRutas(supervisorId);
    }

    // --- ASISTENCIA (Reutilizado de Empleado) ---

    @Post('asistencia/entrada')
    @ApiOperation({ summary: 'Marcar Entrada del Supervisor' })
    marcarEntrada(@Body() dto: RegistrarMiAsistenciaEntradaDto, @Request() req) {
        const userId = req.user.id;
        return this.autoservicioService.marcarAsistenciaEntrada(userId, dto);
    }

    @Post('asistencia/salida')
    @ApiOperation({ summary: 'Marcar Salida del Supervisor' })
    marcarSalida(@Body() dto: RegistrarMiAsistenciaSalidaDto, @Request() req) {
        const userId = req.user.id;
        return this.autoservicioService.marcarAsistenciaSalida(userId, dto);
    }

    @Get('minutas-puestos')
    @ApiOperation({ summary: 'Ver minutas de todos los puestos de la ruta' })
    getMinutasPuestos(@Query('ejecucion_id') ejecucionId: number) {
        return this.autoservicioService.getMinutasRutaAsignada(ejecucionId);
    }

    // Métodos Adicionales Útiles
    @Get('historial')
    @ApiOperation({ summary: 'Historial de Supervisiones' })
    getHistorial(@Query() dto: ConsultarHistorialDto, @Request() req) {
        const supervisorId = req.user.empleadoId;
        return this.autoservicioService.consultarHistorialSupervisor(supervisorId, dto);
    }

    @Get('tipos-chequeo')
    @ApiOperation({ summary: 'Tipos de Chequeo Disponibles' })
    getTiposChequeo() {
        return this.autoservicioService.obtenerTiposChequeo();
    }

    @Get('checkeos/preguntas')
    @ApiOperation({ summary: 'Obtener preguntas específicas del checklist por tipo' })
    @ApiQuery({ name: 'tipo_chequeo_id', required: true, type: Number })
    getChecklistItems(@Query('tipo_chequeo_id') tipoChequeoId: number) {
        return this.autoservicioService.getChecklistItems(tipoChequeoId);
    }
}
