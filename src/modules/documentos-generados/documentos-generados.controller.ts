import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    UseGuards,
    ParseIntPipe,
    Query,
} from "@nestjs/common";
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiQuery,
} from "@nestjs/swagger";
import { DocumentosGeneradosService } from "./documentos-generados.service";
import { CreateDocumentoDto, UpdateDocumentoGeneradoDto } from "./dto/documento-generado.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";

import { CurrentUser } from "../auth/decorators/current-user.decorator";

@ApiTags("Documentos Generados")
@Controller("documentos-generados")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class DocumentosGeneradosController {
    constructor(private readonly documentosService: DocumentosGeneradosService) { }

    @Get()
    @RequirePermissions("documentos")
    @ApiOperation({ summary: "Listar todos los documentos generados" })
    @ApiQuery({ name: "entidad_tipo", required: false })
    @ApiQuery({ name: "estado", required: false })
    @ApiQuery({ name: "entidad_id", required: false, type: Number })
    @ApiResponse({ status: 200, description: "Lista de documentos" })
    async findAll(
        @Query("entidad_tipo") entidad_tipo?: string,
        @Query("estado") estado?: string,
        @Query("entidad_id") entidad_id?: string
    ) {
        const filters: any = {};
        if (entidad_tipo) filters.entidad_tipo = entidad_tipo;
        if (estado) filters.estado = estado;
        if (entidad_id) filters.entidad_id = parseInt(entidad_id);

        return this.documentosService.findAll(filters);
    }

    // 🟢 BLOQUE 6 - Advanced Search
    @Get('buscar')
    @RequirePermissions("documentos")
    @ApiOperation({ summary: "Búsqueda avanzada de documentos" })
    @ApiQuery({ name: "q", required: false, description: "Texto de búsqueda libre" })
    @ApiQuery({ name: "desde", required: false })
    @ApiQuery({ name: "hasta", required: false })
    @ApiQuery({ name: "estado", required: false })
    async buscar(
        @Query("q") q?: string,
        @Query("desde") desde?: string,
        @Query("hasta") hasta?: string,
        @Query("estado") estado?: string
    ) {
        return this.documentosService.buscar({ q, desde, hasta, estado });
    }

    @Get(":id")
    @RequirePermissions("documentos")
    @ApiOperation({ summary: "Obtener documento por ID" })
    @ApiResponse({ status: 200, description: "Documento encontrado" })
    @ApiResponse({ status: 404, description: "Documento no encontrado" })
    async findOne(@Param("id", ParseIntPipe) id: number) {
        return this.documentosService.findOne(id);
    }

    @Get("codigo/:codigo")
    @RequirePermissions("documentos")
    @ApiOperation({ summary: "Verificar documento por código QR" })
    @ApiResponse({ status: 200, description: "Documento verificado" })
    async verifyByCodigo(@Param("codigo") codigo: string) {
        return this.documentosService.findByCodigoReferencia(codigo);
    }

    @Post()
    @RequirePermissions("documentos", "crear")
    @ApiOperation({ summary: "Crear documento generado" })
    @ApiResponse({ status: 201, description: "Documento creado exitosamente" })
    async create(@Body() createDto: CreateDocumentoDto, @CurrentUser() user: any) {
        return this.documentosService.create(createDto, user);
    }

    @Put(":id")
    @RequirePermissions("documentos", "actualizar")
    @ApiOperation({ summary: "Actualizar documento" })
    @ApiResponse({ status: 200, description: "Documento actualizado exitosamente" })
    async update(
        @Param("id", ParseIntPipe) id: number,
        @Body() updateDto: UpdateDocumentoGeneradoDto
    ) {
        return this.documentosService.update(id, updateDto);
    }

    @Delete(":id/anular")
    @RequirePermissions("documentos", "eliminar")
    @ApiOperation({ summary: "Anular documento" })
    @ApiResponse({ status: 200, description: "Documento anulado exitosamente" })
    async anular(@Param("id", ParseIntPipe) id: number, @Body("motivo") motivo: string) {
        return this.documentosService.anular(id, motivo || 'Anulado por usuario');
    }

    // 🟢 BLOQUE 3 - State Transitions for Documents
    @Post(":id/generar-pdf")
    @RequirePermissions("documentos", "generar")
    @ApiOperation({ summary: "Generar PDF del documento" })
    @ApiResponse({ status: 200, description: "PDF generado exitosamente" })
    async generarPdf(@Param("id", ParseIntPipe) id: number) {
        return this.documentosService.generarPdf(id);
    }

    @Post(":id/enviar-firmas")
    @RequirePermissions("documentos", "enviar")
    @ApiOperation({ summary: "Enviar documento para firmas" })
    @ApiResponse({ status: 200, description: "Documento enviado para firmas" })
    async enviarFirmas(@Param("id", ParseIntPipe) id: number) {
        return this.documentosService.enviarFirmas(id);
    }

    @Post(":id/cerrar")
    @RequirePermissions("documentos", "cerrar")
    @ApiOperation({ summary: "Cerrar documento" })
    @ApiResponse({ status: 200, description: "Documento cerrado exitosamente" })
    async cerrar(@Param("id", ParseIntPipe) id: number) {
        return this.documentosService.cerrar(id);
    }

    @Get(":id/firmas")
    @RequirePermissions("documentos")
    @ApiOperation({ summary: "Obtener firmas del documento" })
    @ApiResponse({ status: 200, description: "Lista de firmas" })
    async getFirmas(@Param("id", ParseIntPipe) id: number) {
        return this.documentosService.getFirmas(id);
    }

    @Post(":id/finalizar")
    @RequirePermissions("documentos", "cerrar")
    @ApiOperation({ summary: "Finalizar documento (bloqueo definitivo)" })
    async finalizar(@Param("id", ParseIntPipe) id: number) {
        return this.documentosService.finalizar(id);
    }

    @Get(":id/historial")
    @RequirePermissions("documentos")
    @ApiOperation({ summary: "Auditoría del documento" })
    async getHistorial(@Param("id", ParseIntPipe) id: number) {
        return this.documentosService.getHistorial(id);
    }

    @Post(":id/reenviar")
    @RequirePermissions("documentos", "enviar")
    @ApiOperation({ summary: "Reenviar notificaciones a firmantes" })
    async reenviar(@Param("id", ParseIntPipe) id: number) {
        return this.documentosService.reenviar(id);
    }
}
