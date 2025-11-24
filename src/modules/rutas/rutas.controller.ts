import { Controller, Get, Post, Body, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { RutasService } from "./rutas.service";
import { CreateRutaGpsDto, CreateRecorridoSupervisorDto, CreateRondaRonderoDto } from "./dto/ruta.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";

@ApiTags("Rutas y Recorridos")
@Controller("rutas")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class RutasController {
    constructor(private readonly rutasService: RutasService) { }

    // --- Rutas GPS ---
    @Post("gps")
    @RequirePermissions("rutas")
    @ApiOperation({ summary: "Registrar punto GPS" })
    async createRutaGps(@Body() createDto: CreateRutaGpsDto) {
        return this.rutasService.createRutaGps(createDto);
    }

    @Get("gps")
    @RequirePermissions("rutas")
    @ApiOperation({ summary: "Obtener historial GPS" })
    @ApiQuery({ name: "empleadoId", required: false })
    async getRutasGps(@Query("empleadoId") empleadoId?: number) {
        return this.rutasService.getRutasGps(empleadoId);
    }

    // --- Recorridos Supervisor ---
    @Post("recorridos")
    @RequirePermissions("rutas")
    @ApiOperation({ summary: "Registrar recorrido de supervisor" })
    async createRecorrido(@Body() createDto: CreateRecorridoSupervisorDto) {
        return this.rutasService.createRecorrido(createDto);
    }

    @Get("recorridos")
    @RequirePermissions("rutas")
    @ApiOperation({ summary: "Obtener recorridos" })
    @ApiQuery({ name: "supervisorId", required: false })
    async getRecorridos(@Query("supervisorId") supervisorId?: number) {
        return this.rutasService.getRecorridos(supervisorId);
    }

    // --- Rondas Ronderos ---
    @Post("rondas")
    @RequirePermissions("rutas")
    @ApiOperation({ summary: "Registrar ronda" })
    async createRonda(@Body() createDto: CreateRondaRonderoDto) {
        return this.rutasService.createRonda(createDto);
    }

    @Get("rondas")
    @RequirePermissions("rutas")
    @ApiOperation({ summary: "Obtener rondas" })
    @ApiQuery({ name: "ronderoId", required: false })
    async getRondas(@Query("ronderoId") ronderoId?: number) {
        return this.rutasService.getRondas(ronderoId);
    }
}
