import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UbicacionesService } from './ubicaciones.service';
import { RegistrarUbicacionDto, FilterUbicacionDto, MapaUbicacionDto } from './dto/ubicaciones.dto';

@ApiTags('Ubicación de Empleados')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class UbicacionesController {
    constructor(private readonly service: UbicacionesService) { }

    @Post('empleados/ubicaciones')
    @ApiOperation({ summary: '1. Registrar Ubicación (TRACKING)' })
    async registrar(@Body() dto: RegistrarUbicacionDto) {
        return this.service.registrar(dto);
    }

    @Get('empleados/:id/ubicacion/ultima')
    @ApiOperation({ summary: '2. Última Ubicación de un Empleado' })
    async getUltima(@Param('id') id: number) {
        return this.service.getUltima(id);
    }

    @Get('empleados/:id/ubicaciones')
    @ApiOperation({ summary: '3. Historial de Ubicaciones (Replay)' })
    async getHistorial(@Param('id') id: number, @Query() filters: FilterUbicacionDto) {
        return this.service.getHistorial(id, filters);
    }

    @Get('sesiones/:id/ubicaciones')
    @ApiOperation({ summary: '4. Ubicaciones por Sesión' })
    async getBySesion(@Param('id') id: number) {
        return this.service.getBySesion(id);
    }

    @Get('empleados/ubicaciones/mapa')
    @ApiOperation({ summary: '5. Ubicaciones en un Rango Geográfico (Mapa)' })
    async getMapa(@Query() dto: MapaUbicacionDto) {
        return this.service.getMapa(dto);
    }

    @Post('empleados/ubicaciones/boton-panico')
    @ApiOperation({ summary: '6. Vincular Ubicación a Botón de Pánico (AUTO)' })
    async vincularPanico(@Body() dto: RegistrarUbicacionDto) {
        return this.service.vincularPanico(dto);
    }
}
