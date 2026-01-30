import { Controller, Get, Post, Body, Param, UseGuards, ParseIntPipe, Query } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { ConsentimientosService } from "./consentimientos.service";
import { CreateConsentimientoDto } from "./dto/consentimiento.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";

@ApiTags("Consentimientos")
@Controller("consentimientos")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class ConsentimientosController {
    constructor(private readonly consentimientosService: ConsentimientosService) { }

    @Get()
    @RequirePermissions("empleados")
    @ApiOperation({ summary: "Listar consentimientos" })
    @ApiQuery({ name: "empleado_id", required: false, type: Number })
    @ApiQuery({ name: "tipo", required: false })
    async findAll(
        @Query("empleado_id") empleado_id?: string,
        @Query("tipo") tipo?: string
    ) {
        const filters: any = {};
        if (empleado_id) filters.empleado_id = parseInt(empleado_id);
        if (tipo) filters.tipo = tipo;

        return this.consentimientosService.findAll(filters);
    }

    @Post()
    @RequirePermissions("empleados", "crear")
    @ApiOperation({ summary: "Registrar consentimiento" })
    async create(@Body() createDto: CreateConsentimientoDto) {
        return this.consentimientosService.create(createDto);
    }

    @Get("empleado/:empleadoId")
    @RequirePermissions("empleados")
    @ApiOperation({ summary: "Obtener consentimientos de un empleado" })
    async getByEmpleado(@Param("empleadoId", ParseIntPipe) empleadoId: number) {
        return this.consentimientosService.getByEmpleado(empleadoId);
    }
}
