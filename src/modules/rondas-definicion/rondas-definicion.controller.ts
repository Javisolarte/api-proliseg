import { Controller, Get, Post, Body, Param, UseGuards, ParseIntPipe, Query } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { RondasDefinicionService } from "./rondas-definicion.service";
import { CreateRondaDefinicionDto, CreatePuntoDto } from "./dto/ronda.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";

@ApiTags("Rondas - Definición")
@Controller("rondas-definicion")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class RondasDefinicionController {
    constructor(private readonly rondasService: RondasDefinicionService) { }

    @Get()
    @RequirePermissions("rondas")
    @ApiOperation({ summary: "Listar definiciones de rondas" })
    @ApiQuery({ name: "puesto_id", required: false, type: Number })
    @ApiQuery({ name: "activa", required: false, type: Boolean })
    async findAll(
        @Query("puesto_id") puesto_id?: string,
        @Query("activa") activa?: string
    ) {
        const filters: any = {};
        if (puesto_id) filters.puesto_id = parseInt(puesto_id);
        if (activa) filters.activa = activa === 'true';

        return this.rondasService.findAll(filters);
    }

    @Get(":id")
    @RequirePermissions("rondas")
    @ApiOperation({ summary: "Obtener ronda por ID" })
    async findOne(@Param("id", ParseIntPipe) id: number) {
        return this.rondasService.findOne(id);
    }

    @Post()
    @RequirePermissions("rondas", "crear")
    @ApiOperation({ summary: "Crear definición de ronda" })
    async create(@Body() createDto: CreateRondaDefinicionDto, @CurrentUser() user: any) {
        return this.rondasService.create(createDto, user.id);
    }

    @Get(":id/puntos")
    @RequirePermissions("rondas")
    @ApiOperation({ summary: "Obtener puntos de una ronda" })
    async getPuntos(@Param("id", ParseIntPipe) id: number) {
        return this.rondasService.getPuntos(id);
    }

    @Post("puntos")
    @RequirePermissions("rondas", "crear")
    @ApiOperation({ summary: "Crear punto para una ronda" })
    async createPunto(@Body() createDto: CreatePuntoDto) {
        return this.rondasService.createPunto(createDto);
    }
}
