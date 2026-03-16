import { Controller, Get, Post, Patch, Body, Param, UseGuards, ParseIntPipe } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
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
    async iniciarVisita(
        @Param("id", ParseIntPipe) id: number,
        @CurrentUser() user: any,
        @Body() dto: IniciarVisitaDto
    ) {
        return this.visitasService.iniciarVisita(id, user.id, dto);
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
    async subirFoto(
        @Param("id", ParseIntPipe) id: number,
        @Body("url") url: string
    ) {
        return this.visitasService.subirEvidencia(id, url);
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
