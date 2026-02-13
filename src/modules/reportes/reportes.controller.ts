import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, ParseIntPipe, Put, Res } from "@nestjs/common";
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
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

    @Get("operativo")
    @RequirePermissions("reportes")
    @ApiOperation({ summary: "Generar reporte operativo unificado" })
    @ApiQuery({ name: "puesto_id", type: Number, required: true })
    @ApiQuery({ name: "fecha_inicio", type: String, required: true })
    @ApiQuery({ name: "fecha_fin", type: String, required: true })
    async generarReporteOperativo(
        @Query("puesto_id", ParseIntPipe) puesto_id: number,
        @Query("fecha_inicio") fecha_inicio: string,
        @Query("fecha_fin") fecha_fin: string
    ) {
        return this.reportesService.generarReporteOperativo(puesto_id, fecha_inicio, fecha_fin);
    }

    @Get("empleados/pdf")
    @RequirePermissions("reportes.export")
    @ApiOperation({ summary: "Exportar todos los empleados a PDF" })
    async exportEmpleadosPDF(@Res() res: Response) {
        return this.reportesService.exportEmpleadosPDF(res);
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
