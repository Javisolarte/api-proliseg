import { Controller, Get, Post, Patch, Body, Param, UseGuards, ParseIntPipe, Query, UseInterceptors, UploadedFile } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { ListasAccesoService } from "./listas-acceso.service";
import { CreateListaAccesoDto } from "./dto/lista-acceso.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";

@ApiTags("Listas de Acceso")
@Controller("listas-acceso")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class ListasAccesoController {
    constructor(private readonly listasService: ListasAccesoService) { }

    @Get()
    @RequirePermissions("listas_acceso")
    @ApiOperation({ summary: "Listar entradas de listas de acceso" })
    @ApiQuery({ name: "puesto_id", required: false, type: Number })
    @ApiQuery({ name: "tipo_lista", required: false })
    @ApiQuery({ name: "activo", required: false, type: Boolean })
    async findAll(
        @Query("puesto_id") puesto_id?: string,
        @Query("tipo_lista") tipo_lista?: string,
        @Query("activo") activo?: string
    ) {
        const filters: any = {};
        if (puesto_id) filters.puesto_id = parseInt(puesto_id);
        if (tipo_lista) filters.tipo_lista = tipo_lista;
        if (activo) filters.activo = activo === 'true';

        return this.listasService.findAll(filters);
    }

    @Post()
    @RequirePermissions("listas_acceso", "crear")
    @ApiOperation({ summary: "Agregar entrada a lista de acceso (documento o placa)" })
    async create(@Body() createDto: CreateListaAccesoDto, @CurrentUser() user: any) {
        return this.listasService.create(createDto, user.id);
    }

    @Get("verificar/documento/:documento")
    @RequirePermissions("listas_acceso")
    @ApiOperation({ summary: "Verificar si un documento está en lista blanca/negra" })
    @ApiQuery({ name: "puesto_id", required: false, type: Number })
    async verificarDocumento(
        @Param("documento") documento: string,
        @Query("puesto_id") puesto_id?: string
    ) {
        const puestoIdNum = puesto_id ? parseInt(puesto_id) : undefined;
        return this.listasService.verificarDocumento(documento, puestoIdNum);
    }

    @Get("verificar/placa/:placa")
    @RequirePermissions("listas_acceso")
    @ApiOperation({ summary: "Verificar si una placa está en lista blanca/negra" })
    @ApiQuery({ name: "puesto_id", required: false, type: Number })
    async verificarPlaca(
        @Param("placa") placa: string,
        @Query("puesto_id") puesto_id?: string
    ) {
        const puestoIdNum = puesto_id ? parseInt(puesto_id) : undefined;
        return this.listasService.verificarPlaca(placa, puestoIdNum);
    }

    @Patch(":id/desactivar")
    @RequirePermissions("listas_acceso", "actualizar")
    @ApiOperation({ summary: "Desactivar entrada de lista" })
    async desactivar(@Param("id", ParseIntPipe) id: number) {
        return this.listasService.desactivar(id);
    }

    @Post("importar")
    @RequirePermissions("listas_acceso", "crear")
    @ApiOperation({ summary: "Importación masiva de lista de acceso (Array JSON)" })
    async importar(@Body() datos: any[], @CurrentUser() user: any) {
        return this.listasService.importarMasivo(datos, user.id);
    }

    @Post("importar-excel")
    @RequirePermissions("listas_acceso", "crear")
    @UseInterceptors(FileInterceptor("file"))
    @ApiOperation({ summary: "Importación masiva via Excel (.xlsx)" })
    async importarExcel(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: any) {
        return this.listasService.importarExcel(file.buffer, user.id);
    }

    @Get("historial/logs")
    @RequirePermissions("listas_acceso", "ver_admin")
    @ApiOperation({ summary: "Ver historial de cambios/logs de listas" })
    async getHistorial() {
        return this.listasService.getHistorial();
    }
}
