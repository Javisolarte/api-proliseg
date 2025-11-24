import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger";
import { ReportesService } from "./reportes.service";
import { CreateReporteDto, UpdateReporteDto } from "./dto/reporte.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";

@ApiTags("Reportes")
@Controller("reportes")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class ReportesController {
    constructor(private readonly reportesService: ReportesService) { }

    @Post()
    @RequirePermissions("reportes")
    @ApiOperation({ summary: "Crear reporte" })
    async create(@Body() createReporteDto: CreateReporteDto) {
        return this.reportesService.create(createReporteDto);
    }

    @Get()
    @RequirePermissions("reportes")
    @ApiOperation({ summary: "Listar reportes" })
    async findAll() {
        return this.reportesService.findAll();
    }

    @Get(":id")
    @RequirePermissions("reportes")
    @ApiOperation({ summary: "Obtener reporte por ID" })
    async findOne(@Param("id") id: number) {
        return this.reportesService.findOne(id);
    }

    @Put(":id")
    @RequirePermissions("reportes")
    @ApiOperation({ summary: "Actualizar reporte" })
    async update(@Param("id") id: number, @Body() updateReporteDto: UpdateReporteDto) {
        return this.reportesService.update(id, updateReporteDto);
    }

    @Delete(":id")
    @RequirePermissions("reportes")
    @ApiOperation({ summary: "Eliminar reporte" })
    async remove(@Param("id") id: number) {
        return this.reportesService.remove(id);
    }
}
