
import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, ParseIntPipe, Query } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { ResidentesService } from "./residentes.service";
import { CreateResidenteDto, UpdateResidenteDto, CreateResidenteVehiculoDto } from "./dto/residente.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";

@ApiTags("Residentes")
@Controller("residentes")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class ResidentesController {
    constructor(private readonly residentesService: ResidentesService) { }

    @Get()
    @RequirePermissions("residentes")
    @ApiOperation({ summary: "Listar residentes" })
    @ApiQuery({ name: "puesto_id", required: false, type: Number })
    @ApiQuery({ name: "cliente_id", required: false, type: Number })
    @ApiQuery({ name: "activo", required: false, type: Boolean })
    async findAll(
        @Query("puesto_id") puesto_id?: string,
        @Query("cliente_id") cliente_id?: string,
        @Query("activo") activo?: string
    ) {
        const filters: any = {};
        if (puesto_id) filters.puesto_id = parseInt(puesto_id);
        if (cliente_id) filters.cliente_id = parseInt(cliente_id);
        if (activo) filters.activo = activo === 'true';

        return this.residentesService.findAll(filters);
    }

    @Get(":id")
    @RequirePermissions("residentes")
    @ApiOperation({ summary: "Obtener residente por ID" })
    async findOne(@Param("id", ParseIntPipe) id: number) {
        return this.residentesService.findOne(id);
    }

    @Post()
    @RequirePermissions("residentes", "crear")
    @ApiOperation({ summary: "Crear residente" })
    async create(@Body() createDto: CreateResidenteDto) {
        return this.residentesService.create(createDto);
    }

    @Patch(":id")
    @RequirePermissions("residentes", "actualizar")
    @ApiOperation({ summary: "Actualizar residente" })
    async update(
        @Param("id", ParseIntPipe) id: number,
        @Body() updateDto: UpdateResidenteDto
    ) {
        return this.residentesService.update(id, updateDto);
    }

    @Delete(":id")
    @RequirePermissions("residentes", "eliminar")
    @ApiOperation({ summary: "Desactivar residente (Soft Delete)" })
    async remove(@Param("id", ParseIntPipe) id: number) {
        return this.residentesService.update(id, { activo: false });
    }

    @Get(":id/vehiculos")
    @RequirePermissions("residentes")
    @ApiOperation({ summary: "Obtener vehículos de residente" })
    async getVehiculos(@Param("id", ParseIntPipe) id: number) {
        return this.residentesService.getVehiculos(id);
    }

    @Post("vehiculo")
    @RequirePermissions("residentes", "crear")
    @ApiOperation({ summary: "Registrar vehículo de residente" })
    async createVehiculo(@Body() createDto: CreateResidenteVehiculoDto) {
        return this.residentesService.createVehiculo(createDto);
    }
}

