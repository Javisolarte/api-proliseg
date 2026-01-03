import { Controller, Get, Post, Body, UseGuards, Request, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { SupervisorService } from './supervisor.service';
import {
    RegistrarGpsDto, IniciarRutaDto, FinalizarRutaDto,
    IniciarVisitaDto, FinalizarVisitaDto, RegistrarChequeoDto,
    RegistrarMinutaDto, CargarEvidenciaDto
} from './dto/supervisor.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Módulo Supervisor (Móvil)')
@Controller('supervisor')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("JWT-auth")
export class SupervisorController {
    constructor(private readonly supervisorService: SupervisorService) { }

    private getUser(req: any): number {
        // Asumiendo que el JWT strategy devuelve { userId: 123, email: ... } y userId es el ID de EMPLEADO.
        // Ajustar segun Auth real.
        return req.user?.id || req.user?.userId;
    }

    @Get('perfil')
    @ApiOperation({ summary: '1. Perfil Operativo del Supervisor' })
    getPerfil(@Request() req) {
        return this.supervisorService.getPerfil(this.getUser(req));
    }

    @Get('turno-activo')
    @ApiOperation({ summary: '2. Turno Activo' })
    getTurno(@Request() req) {
        return this.supervisorService.getTurnoActivo(this.getUser(req));
    }

    @Get('ruta-actual')
    @ApiOperation({ summary: '3. Ruta Actual del Turno' })
    getRuta(@Request() req) {
        return this.supervisorService.getRutaActual(this.getUser(req));
    }

    @Post('ruta/iniciar')
    @ApiOperation({ summary: '4. Iniciar Ejecución de Ruta' })
    iniciarRuta(@Request() req, @Body() dto: IniciarRutaDto) {
        return this.supervisorService.iniciarRuta(this.getUser(req), dto);
    }

    @Post('ruta/finalizar')
    @ApiOperation({ summary: '5. Finalizar Ejecución de Ruta' })
    finalizarRuta(@Request() req, @Body() dto: FinalizarRutaDto) {
        return this.supervisorService.finalizarRuta(this.getUser(req), dto);
    }

    @Post('gps')
    @ApiOperation({ summary: '6. Registrar GPS (Tracking)' })
    registrarGps(@Request() req, @Body() dto: RegistrarGpsDto) {
        return this.supervisorService.registrarGps(this.getUser(req), dto);
    }

    @Get('ubicacion-actual')
    @ApiOperation({ summary: '7. Ubicación Actual' })
    getUbicacion(@Request() req) {
        return this.supervisorService.getUbicacionActual(this.getUser(req));
    }

    @Get('ubicaciones-activas')
    @ApiOperation({ summary: '8. Ubicaciones Activas (Central)' })
    getUbicacionesActivas() {
        return this.supervisorService.getUbicacionesActivas();
    }

    @Post('visitas/iniciar')
    @ApiOperation({ summary: '9. Iniciar Visita a Puesto' })
    iniciarVisita(@Request() req, @Body() dto: IniciarVisitaDto) {
        return this.supervisorService.iniciarVisita(this.getUser(req), dto);
    }

    @Post('visitas/finalizar')
    @ApiOperation({ summary: '10. Finalizar Visita a Puesto' })
    finalizarVisita(@Body() dto: FinalizarVisitaDto) {
        return this.supervisorService.finalizarVisita(dto);
    }

    @Get('checkeos/pendientes')
    @ApiOperation({ summary: '11. Checkeos Pendientes' })
    getCheckeos(@Request() req) {
        return this.supervisorService.getCheckeosPendientes(this.getUser(req));
    }

    @Post('checkeos')
    @ApiOperation({ summary: '12. Registrar Checkeo' })
    registrarCheckeo(@Request() req, @Body() dto: RegistrarChequeoDto) {
        return this.supervisorService.registrarChequeo(this.getUser(req), dto);
    }

    @Get('minutas/pendientes')
    @ApiOperation({ summary: '13. Minutas Pendientes' })
    getMinutas(@Request() req) {
        return this.supervisorService.getMinutasPendientes(this.getUser(req));
    }

    @Post('minutas')
    @ApiOperation({ summary: '14. Registrar Minuta' })
    registrarMinuta(@Request() req, @Body() dto: RegistrarMinutaDto) {
        return this.supervisorService.registrarMinuta(this.getUser(req), dto);
    }

    @Post('evidencias')
    @ApiOperation({ summary: '15. Cargar Evidencia' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FileInterceptor('file'))
    @ApiBody({
        description: 'Módulo de carga de evidencias',
        type: CargarEvidenciaDto,
    })
    subirEvidencia(@Request() req, @UploadedFile() file: Express.Multer.File, @Body() dto: CargarEvidenciaDto) {
        return this.supervisorService.uploadEvidencia(file, this.getUser(req), dto);
    }

    @Get('vehiculo')
    @ApiOperation({ summary: '16. Vehículo Asignado' })
    getVehiculo(@Request() req) {
        return this.supervisorService.getVehiculoAsignado(this.getUser(req));
    }
}
