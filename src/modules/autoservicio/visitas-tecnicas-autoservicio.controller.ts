import { Controller, Get, Post, Patch, Body, Param, UseGuards, ParseIntPipe, UseInterceptors, UploadedFile, BadRequestException } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { VisitasTecnicasService } from "../visitas-tecnicas/visitas-tecnicas.service";
import { 
    IniciarVisitaDto, 
    ActualizarVisitaAppDto, 
    FinalizarVisitaAppDto 
} from "./dto/visitas-tecnicas-autoservicio.dto";

@ApiTags("Autoservicio - Técnicos (Visitas)")
@Controller("mi-gestion/visitas")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("JWT-auth")
export class VisitasTecnicasAutoservicioController {
    constructor(private readonly visitasService: VisitasTecnicasService) {}

    @Get()
    @ApiOperation({ summary: "Listar mis visitas técnicas asignadas (Pendientes/En Curso)" })
    async getMisVisitas(@CurrentUser() user: any) {
        return this.visitasService.findMisVisitas(user.id);
    }

    @Get(":id")
    @ApiOperation({ summary: "Ver detalle de una visita específica" })
    async getDetalle(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: any) {
        // Podríamos rehusar findOne pero validando que esté asignada al usuario
        const visita = await this.visitasService.findOne(id);
        if (visita.asignado_a !== user.id) {
            throw new Error("No tienes acceso a esta visita");
        }
        return visita;
    }

    @Post(":id/iniciar")
    @ApiOperation({ summary: "Registrar llegada e inicio de visita (Foto obligatoria)" })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                },
                notas_llegada: {
                    type: 'string',
                    nullable: true
                }
            },
        },
    })
    @UseInterceptors(FileInterceptor('file'))
    async iniciarVisita(
        @Param("id", ParseIntPipe) id: number,
        @CurrentUser() user: any,
        @UploadedFile() file: any,
        @Body() body: any // Se usa body para sacar notas_llegada, ya que DTO en multipart puede ser tricky sin Parse
    ) {
        if (!file) throw new BadRequestException("La foto de llegada es obligatoria");
        
        const dto: IniciarVisitaDto = {
            foto_llegada_url: '', // Se llenará en el service tras subir
            notas_llegada: body.notas_llegada
        };
        return this.visitasService.iniciarVisitaWithFile(id, user.id, file, dto);
    }

    @Patch(":id/actualizar")
    @ApiOperation({ summary: "Agregar notas, fotos o costo durante la visita" })
    async actualizarVisita(
        @Param("id", ParseIntPipe) id: number,
        @CurrentUser() user: any,
        @Body() dto: ActualizarVisitaAppDto
    ) {
        return this.visitasService.actualizarVisitaApp(id, user.id, dto);
    }

    @Post(":id/evidencia")
    @ApiOperation({ summary: "Subir una foto individual de evidencia" })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                },
            },
        },
    })
    @UseInterceptors(FileInterceptor('file'))
    async subirFoto(
        @Param("id", ParseIntPipe) id: number,
        @UploadedFile() file: any
    ) {
        if (!file) throw new BadRequestException("El archivo de evidencia es obligatorio");
        return this.visitasService.subirEvidenciaFile(id, file);
    }

    @Patch(":id/finalizar")
    @ApiOperation({ summary: "Registrar salida, conclusión y firmas (Cierra la visita)" })
    async finalizarVisita(
        @Param("id", ParseIntPipe) id: number,
        @CurrentUser() user: any,
        @Body() dto: FinalizarVisitaAppDto
    ) {
        return this.visitasService.finalizarVisitaApp(id, user.id, dto);
    }
}
