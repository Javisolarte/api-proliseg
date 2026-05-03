import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Query, UseInterceptors, UploadedFile, BadRequestException } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import { VisitasPreliminareService } from "./visitas-preliminares.service";
import { CreateVisitaPreliminarDto, UpdateVisitaPreliminarDto } from "./dto/visita-preliminar.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";

@ApiTags("Visitas Preliminares / Inspección Prospectos")
@Controller("visitas-preliminares")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class VisitasPreliminareController {
    constructor(private readonly visitasService: VisitasPreliminareService) { }

    @Get()
    @RequirePermissions("visitas")
    @ApiOperation({ summary: "Listar visitas preliminares" })
    @ApiQuery({ name: "cliente_potencial_id", required: false })
    @ApiQuery({ name: "estado", required: false })
    async findAll(@Query("cliente_potencial_id") cliente_potencial_id?: string, @Query("estado") estado?: string) {
        const filters: any = {};
        if (cliente_potencial_id) filters.cliente_potencial_id = cliente_potencial_id;
        if (estado) filters.estado = estado;
        return this.visitasService.findAll(filters);
    }

    @Get(":id")
    @RequirePermissions("visitas")
    @ApiOperation({ summary: "Obtener visita preliminar por ID" })
    async findOne(@Param("id") id: string) {
        return this.visitasService.findOne(id);
    }

    @Post()
    @RequirePermissions("visitas")
    @ApiOperation({ summary: "Programar visita preliminar" })
    async create(@Body() createDto: CreateVisitaPreliminarDto, @CurrentUser() user: any) {
        return this.visitasService.create(createDto, user.id);
    }

    @Patch(":id/salida")
    @RequirePermissions("visitas")
    @ApiOperation({ summary: "Registrar salida y resultados" })
    async registrarSalida(@Param("id") id: string, @Body() updateDto: UpdateVisitaPreliminarDto) {
        return this.visitasService.registrarSalida(id, updateDto);
    }

    @Patch(":id")
    @RequirePermissions("visitas")
    @ApiOperation({ summary: "Actualizar visita preliminar" })
    async update(@Param("id") id: string, @Body() body: any) {
        return this.visitasService.update(id, body);
    }

    @Post(":id/finalizar")
    @RequirePermissions("visitas")
    @ApiOperation({ summary: "Finalizar visita preliminar (con firmas)" })
    async finalizarVisita(@Param("id") id: string, @Body() body: any) {
        return this.visitasService.registrarSalida(id, { ...body, estado: 'realizada' });
    }

    @Post(":id/evidencia")
    @RequirePermissions("visitas")
    @ApiOperation({ summary: "Subir URL de evidencia" })
    async subirEvidencia(@Param("id") id: string, @Body("url") url: string) {
        return this.visitasService.subirEvidencia(id, url);
    }

    @Post(":id/foto-evidencia")
    @RequirePermissions("visitas")
    @ApiOperation({ summary: "Subir foto de evidencia" })
    @UseInterceptors(FileInterceptor('file'))
    async subirFotoEvidencia(@Param("id") id: string, @UploadedFile() file: any) {
        if (!file) throw new BadRequestException("El archivo es requerido");
        return this.visitasService.subirEvidenciaFile(id, file);
    }

    @Delete(":id")
    @RequirePermissions("visitas")
    @ApiOperation({ summary: "Eliminar visita preliminar" })
    async remove(@Param("id") id: string) {
        return this.visitasService.remove(id);
    }
}
