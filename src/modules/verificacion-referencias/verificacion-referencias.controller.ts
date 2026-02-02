import { Controller, Get, Post, Patch, Body, Param, UseGuards, ParseIntPipe, Query } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { VerificacionReferenciasService } from "./verificacion-referencias.service";
import { CreateVerificacionDto, CreateReferenciaDetalleDto, FinalizarVerificacionDto } from "./dto/verificacion.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";

@ApiTags("Verificación de Referencias")
@Controller("verificacion-referencias")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class VerificacionReferenciasController {
    constructor(private readonly verificacionService: VerificacionReferenciasService) { }

    @Get()
    @RequirePermissions("empleados")
    @ApiOperation({ summary: "Listar verificaciones de referencias" })
    @ApiQuery({ name: "aspirante_id", required: false, type: Number })
    @ApiQuery({ name: "empleado_id", required: false, type: Number })
    @ApiQuery({ name: "estado", required: false })
    async findAll(
        @Query("aspirante_id") aspirante_id?: string,
        @Query("empleado_id") empleado_id?: string,
        @Query("estado") estado?: string
    ) {
        const filters: any = {};
        if (aspirante_id) filters.aspirante_id = parseInt(aspirante_id);
        if (empleado_id) filters.empleado_id = parseInt(empleado_id);
        if (estado) filters.estado = estado;

        return this.verificacionService.findAll(filters);
    }

    @Get(":id")
    @RequirePermissions("empleados")
    @ApiOperation({ summary: "Obtener verificación por ID" })
    async findOne(@Param("id", ParseIntPipe) id: number) {
        return this.verificacionService.findOne(id);
    }

    @Post()
    @RequirePermissions("empleados")
    @ApiOperation({ summary: "Iniciar verificación de referencias" })
    async create(@Body() createDto: CreateVerificacionDto, @CurrentUser() user: any) {
        return this.verificacionService.create(createDto, user.id);
    }

    @Patch(":id/finalizar")
    @RequirePermissions("empleados")
    @ApiOperation({ summary: "Finalizar verificación" })
    async finalizar(
        @Param("id", ParseIntPipe) id: number,
        @Body() dto: FinalizarVerificacionDto
    ) {
        return this.verificacionService.finalizar(id, dto.conclusiones, dto.documento_final_id);
    }

    @Get(":id/detalles")
    @RequirePermissions("empleados")
    @ApiOperation({ summary: "Obtener detalles de llamadas de verificación" })
    async getDetalles(@Param("id", ParseIntPipe) id: number) {
        return this.verificacionService.getDetalles(id);
    }

    @Post("detalles")
    @RequirePermissions("empleados")
    @ApiOperation({ summary: "Registrar detalle de llamada de referencia" })
    async createDetalle(@Body() createDto: CreateReferenciaDetalleDto) {
        return this.verificacionService.createDetalle(createDto);
    }
}
