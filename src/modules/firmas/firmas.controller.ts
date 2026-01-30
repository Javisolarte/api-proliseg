import {
    Controller,
    Get,
    Post,
    Delete,
    Body,
    Param,
    UseGuards,
    ParseIntPipe,
    Req,
} from "@nestjs/common";
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
} from "@nestjs/swagger";
import { FirmasService } from "./firmas.service";
import { CreateFirmaDto } from "./dto/firma.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import type { Request } from "express";

@ApiTags("Firmas de Documentos")
@Controller("firmas")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class FirmasController {
    constructor(private readonly firmasService: FirmasService) { }

    @Get("documento/:documentoId")
    @RequirePermissions("documentos")
    @ApiOperation({ summary: "Listar firmas de un documento" })
    @ApiResponse({ status: 200, description: "Lista de firmas" })
    async findByDocumento(@Param("documentoId", ParseIntPipe) documentoId: number) {
        return this.firmasService.findByDocumento(documentoId);
    }

    @Get(":id")
    @RequirePermissions("documentos")
    @ApiOperation({ summary: "Obtener firma por ID" })
    @ApiResponse({ status: 200, description: "Firma encontrada" })
    async findOne(@Param("id", ParseIntPipe) id: number) {
        return this.firmasService.findOne(id);
    }

    @Post()
    @RequirePermissions("documentos", "firmar")
    @ApiOperation({ summary: "Agregar firma a documento" })
    @ApiResponse({ status: 201, description: "Firma agregada exitosamente" })
    async create(@Body() createFirmaDto: CreateFirmaDto, @Req() request: Request) {
        const ipAddress = (request.ip || request.headers['x-forwarded-for'] || request.socket.remoteAddress) as string;
        return this.firmasService.create(createFirmaDto, ipAddress);
    }

    @Get("verificar/:token")
    @ApiOperation({ summary: "Verificar firma por token (público)" })
    @ApiResponse({ status: 200, description: "Firma verificada" })
    async verifyToken(@Param("token") token: string) {
        return this.firmasService.verifyToken(token);
    }

    @Delete(":id")
    @RequirePermissions("documentos", "eliminar")
    @ApiOperation({ summary: "Eliminar firma (solo si documento no está finalizado)" })
    @ApiResponse({ status: 200, description: "Firma eliminada exitosamente" })
    async remove(@Param("id", ParseIntPipe) id: number) {
        return this.firmasService.remove(id);
    }

    @Post("ordenar")
    @RequirePermissions("documentos", "actualizar")
    @ApiOperation({ summary: "Reordenar firmas" })
    async ordenar(@Body() ordenes: { id: number, orden: number }[]) {
        return this.firmasService.reordenar(ordenes);
    }

    @Get("documento/:id/estado")
    @RequirePermissions("documentos")
    @ApiOperation({ summary: "Obtener estado detallado de firmas" })
    async getEstado(@Param("id", ParseIntPipe) id: number) {
        return this.firmasService.getEstadoFirmas(id);
    }

    @Post("empleado/:id")
    @RequirePermissions("configuracion", "actualizar")
    @ApiOperation({ summary: "Guardar firma maestra para un empleado" })
    @ApiResponse({ status: 200, description: "Firma maestra guardada" })
    async saveMaster(
        @Param("id", ParseIntPipe) id: number,
        @Body() body: { firma_base64: string, cargo?: string }
    ) {
        return this.firmasService.saveMasterSignature(id, body.firma_base64, body.cargo);
    }
}
