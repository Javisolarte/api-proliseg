import { Controller, Get, Post, Body, Param, UseGuards, ParseIntPipe, Query } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { InventarioPuestoService } from "./inventario-puesto.service";
import { CreateInventarioDto, CreateMovimientoDto } from "./dto/inventario.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";

@ApiTags("Inventario de Puestos")
@Controller("inventario-puesto")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class InventarioPuestoController {
    constructor(private readonly inventarioService: InventarioPuestoService) { }

    @Get()
    @RequirePermissions("dotacion")
    @ApiOperation({ summary: "Consultar inventario actual de puesto" })
    @ApiQuery({ name: "puesto_id", required: false, type: Number })
    async findAll(@Query("puesto_id") puesto_id?: string) {
        const filters: any = {};
        if (puesto_id) filters.puesto_id = parseInt(puesto_id);

        return this.inventarioService.findAll(filters);
    }

    @Post()
    @RequirePermissions("dotacion", "crear")
    @ApiOperation({ summary: "Actualizar/Crear inventario de puesto" })
    async createOrUpdate(@Body() createDto: CreateInventarioDto) {
        return this.inventarioService.createOrUpdate(createDto);
    }

    @Post("movimiento")
    @RequirePermissions("dotacion", "crear")
    @ApiOperation({ summary: "Registrar movimiento de inventario (entrega/retiro)" })
    async registrarMovimiento(@Body() dto: CreateMovimientoDto, @CurrentUser() user: any) {
        return this.inventarioService.registrarMovimiento(dto, user.id);
    }

    @Get(":puestoId/movimientos")
    @RequirePermissions("dotacion")
    @ApiOperation({ summary: "Historial de movimientos de un puesto" })
    async getMovimientos(@Param("puestoId", ParseIntPipe) puestoId: number) {
        return this.inventarioService.getMovimientos(puestoId);
    }
}
