import {
    Controller,
    Get,
    Post,
    Patch,
    Param,
    Body,
    Delete,
    UseGuards,
    Request,
    ParseIntPipe,
    Query,
    Ip,
    UseInterceptors,
    UploadedFile,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { MemorandosService } from "./memorandos.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import {
    CreateMemorandoDto,
    UpdateMemorandoDto,
    AssignMemorandoDto,
    SignMemorandoDto,
    CreateAttachmentDto
} from "./dto/memorando.dto";
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from "@nestjs/swagger";

@ApiTags("Memorandos")
@Controller("memorandos")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class MemorandosController {
    constructor(private readonly memorandosService: MemorandosService) { }

    @Get()
    @RequirePermissions("memorandos")
    @ApiOperation({ summary: "Listar memorandos con filtros" })
    findAll(@Query() filters: any) {
        return this.memorandosService.findAll(filters);
    }

    @Get(":id")
    @RequirePermissions("memorandos")
    @ApiOperation({ summary: "Obtener detalle completo de un memorando" })
    findOne(@Param("id", ParseIntPipe) id: number) {
        return this.memorandosService.findOne(id);
    }

    @Post()
    @RequirePermissions("memorandos")
    @ApiOperation({ summary: "Crear un nuevo memorando (estado borrador)" })
    create(@Body() dto: CreateMemorandoDto, @Request() req) {
        return this.memorandosService.create(dto, req.user.id);
    }

    @Patch(":id")
    @RequirePermissions("memorandos")
    @ApiOperation({ summary: "Actualizar datos de un memorando (solo si está en borrador)" })
    update(
        @Param("id", ParseIntPipe) id: number,
        @Body() dto: UpdateMemorandoDto,
        @Request() req
    ) {
        return this.memorandosService.update(id, dto, req.user.id);
    }

    @Post(":id/asignar")
    @RequirePermissions("memorandos")
    @ApiOperation({ summary: "Asignar memorando a uno o varios empleados" })
    assign(
        @Param("id", ParseIntPipe) id: number,
        @Body() dto: AssignMemorandoDto,
        @Request() req
    ) {
        return this.memorandosService.assign(id, dto, req.user.id);
    }

    @Post(":id/enviar")
    @RequirePermissions("memorandos")
    @ApiOperation({ summary: "Cambiar estado de borrador a enviado y habilitar para empleados" })
    send(@Param("id", ParseIntPipe) id: number, @Request() req) {
        return this.memorandosService.send(id, req.user.id);
    }

    @Post("leer/:idRelacion")
    @RequirePermissions("empleados") // O un permiso específico para leer sus propios memos
    @ApiOperation({ summary: "Marcar memorando como leído por el empleado" })
    markAsRead(@Param("idRelacion", ParseIntPipe) idRelacion: number, @Request() req) {
        return this.memorandosService.markAsRead(idRelacion, req.user.id);
    }

    @Post("firmar/:idRelacion")
    @RequirePermissions("empleados") // O un permiso específico para firmar
    @ApiOperation({ summary: "Registrar firma digital del empleado" })
    sign(
        @Param("idRelacion", ParseIntPipe) idRelacion: number,
        @Body() dto: SignMemorandoDto,
        @Ip() ip: string
    ) {
        return this.memorandosService.sign(idRelacion, dto, ip);
    }

    @Post(":id/adjuntos")
    @UseInterceptors(FileInterceptor("file"))
    @RequirePermissions("memorandos")
    @ApiConsumes("multipart/form-data")
    @ApiBody({
        schema: {
            type: "object",
            properties: {
                file: {
                    type: "string",
                    format: "binary",
                },
                descripcion: {
                    type: "string",
                },
            },
        },
    })
    @ApiOperation({
        summary: "Agregar adjunto/evidencia a un memorando",
        description: "Sube un archivo al bucket 'memorandos' y lo asocia al memorando. El path será memorando/{cedula}/{fileName}"
    })
    @ApiResponse({ status: 201, description: "Adjunto creado y archivo subido correctamente" })
    addAttachment(
        @Param("id", ParseIntPipe) id: number,
        @UploadedFile() file: any,
        @Body("descripcion") descripcion: string,
        @Request() req
    ) {
        return this.memorandosService.addAttachment(id, file, descripcion, req.user.id);
    }

    @Post(":id/cerrar")
    @RequirePermissions("memorandos")
    @ApiOperation({ summary: "Cerrar formalmente un memorando (finalizar proceso)" })
    close(@Param("id", ParseIntPipe) id: number, @Request() req) {
        return this.memorandosService.close(id, req.user.id);
    }

    @Delete(":id")
    @RequirePermissions("memorandos")
    @ApiOperation({ summary: "Eliminar o anular un memorando" })
    delete(@Param("id", ParseIntPipe) id: number, @Request() req) {
        return this.memorandosService.delete(id, req.user.id);
    }
}
