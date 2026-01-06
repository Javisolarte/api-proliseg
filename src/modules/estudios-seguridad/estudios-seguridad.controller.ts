import {
    Controller,
    Get,
    Post,
    Delete,
    Body,
    Param,
    UseGuards,
    ParseIntPipe,
    UploadedFile,
    UseInterceptors,
    BadRequestException,
} from "@nestjs/common";
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiConsumes,
    ApiBody,
} from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import { EstudiosSeguridadService } from "./estudios-seguridad.service";
import { CreateEstudioSeguridadDto } from "./dto/estudios-seguridad.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";

@ApiTags("Estudios de Seguridad")
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class EstudiosSeguridadController {
    constructor(private readonly estudiosSeguridadService: EstudiosSeguridadService) { }

    /**
     * 🔹 Crear nuevo estudio (subida de PDF)
     */
    @Post("api/puestos/:puestoId/estudios-seguridad")
    @RequirePermissions("puestos")
    @ApiOperation({ summary: "Subir nuevo estudio de seguridad para un puesto" })
    @ApiConsumes("multipart/form-data")
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: { type: 'string', format: 'binary' },
                fecha_estudio: { type: 'string', format: 'date', example: '2024-01-01' },
                fecha_vencimiento: { type: 'string', format: 'date', example: '2025-01-01' },
                observaciones: { type: 'string', example: 'Sin observaciones...' },
                estado: { type: 'string', enum: ['vigente', 'vencido', 'anulado'], example: 'vigente' },
            },
        },
    })
    @UseInterceptors(FileInterceptor("file"))
    async create(
        @Param("puestoId", ParseIntPipe) puestoId: number,
        @Body() dto: any, // Usar any temporalmente para extraer campos de multipart
        @UploadedFile() file: any,
        @CurrentUser() user: any
    ) {
        if (!file) throw new BadRequestException("El archivo PDF es requerido");

        // Re-mapear el body al DTO
        const createDto: CreateEstudioSeguridadDto = {
            puesto_id: puestoId,
            fecha_estudio: dto.fecha_estudio,
            fecha_vencimiento: dto.fecha_vencimiento,
            observaciones: dto.observaciones,
            estado: dto.estado,
        };

        return this.estudiosSeguridadService.create(createDto, file, user.id);
    }

    /**
     * 🔹 Listar estudios por puesto
     */
    @Get("api/puestos/:puestoId/estudios-seguridad")
    @RequirePermissions("puestos")
    @ApiOperation({ summary: "Listar todos los estudios de seguridad de un puesto" })
    @ApiResponse({ status: 200, description: "Lista de estudios encontrada" })
    async findAll(@Param("puestoId", ParseIntPipe) puestoId: number) {
        return this.estudiosSeguridadService.findAllByPuesto(puestoId);
    }

    /**
     * 🔹 Obtener estudio por ID
     */
    @Get("api/estudios-seguridad/:id")
    @RequirePermissions("puestos")
    @ApiOperation({ summary: "Obtener un estudio de seguridad por ID" })
    @ApiResponse({ status: 200, description: "Estudio encontrado" })
    async findOne(@Param("id", ParseIntPipe) id: number) {
        return this.estudiosSeguridadService.findOne(id);
    }

    /**
     * 🔹 Eliminar estudio (marcar como anulado)
     */
    @Delete("api/estudios-seguridad/:id")
    @RequirePermissions("puestos")
    @ApiOperation({ summary: "Eliminar (anular) un estudio de seguridad" })
    @ApiResponse({ status: 200, description: "Estudio anulado exitosamente" })
    async remove(@Param("id", ParseIntPipe) id: number) {
        return this.estudiosSeguridadService.remove(id);
    }
}
