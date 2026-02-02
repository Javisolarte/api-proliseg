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
import { PlantillasService } from "./plantillas.service";
import { CreatePlantillaDto, UpdatePlantillaDto } from "./dto/plantilla.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";

@ApiTags("Plantillas de Documentos")
@Controller("plantillas")
@ApiBearerAuth("JWT-auth")
export class PlantillasController {
    constructor(private readonly plantillasService: PlantillasService) { }

    @Get()
    @RequirePermissions("plantillas")
    @ApiOperation({ summary: "Listar todas las plantillas" })
    @ApiQuery({ name: "tipo", required: false, description: "Filtrar por tipo de plantilla" })
    @ApiQuery({ name: "activa", required: false, type: Boolean, description: "Filtrar por estado activo" })
    async findAll(@Query("tipo") tipo?: string) {
        const filters = tipo ? { tipo } : undefined;
        return this.plantillasService.findAll(filters);
    }

    @Get(":id")
    @RequirePermissions("documentos")
    @ApiOperation({ summary: "Obtener plantilla por ID" })
    async findOne(@Param("id", ParseIntPipe) id: number) {
        return this.plantillasService.findOne(id);
    }

    @Post()
    @RequirePermissions("plantillas")
    @ApiOperation({ summary: "Crear nueva plantilla" })
    @ApiResponse({ status: 201, description: "Plantilla creada exitosamente" })
    async create(
        @Body() createPlantillaDto: CreatePlantillaDto,
        @CurrentUser() user: any
    ) {
        return this.plantillasService.create(createPlantillaDto, user.id);
    }

    @Put(":id")
    @RequirePermissions("plantillas")
    @ApiOperation({ summary: "Actualizar plantilla" })
    @ApiResponse({ status: 200, description: "Plantilla actualizada exitosamente" })
    async update(
        @Param("id", ParseIntPipe) id: number,
        @Body() updatePlantillaDto: UpdatePlantillaDto,
        @CurrentUser() user: any
    ) {
        return this.plantillasService.update(id, updatePlantillaDto, user.id);
    }

    @Delete(":id")
    @RequirePermissions("plantillas")
    @ApiOperation({ summary: "Desactivar plantilla (soft delete)" })
    @ApiResponse({ status: 200, description: "Plantilla desactivada exitosamente" })
    async remove(
        @Param("id", ParseIntPipe) id: number,
        @CurrentUser() user: any
    ) {
        return this.plantillasService.softDelete(id, user.id);
    }

    @Post(":id/render-preview")
    @RequirePermissions("plantillas")
    @ApiOperation({
        summary: "Vista previa de plantilla con datos de muestra",
        description: "Renderiza la plantilla con datos de ejemplo para verificar el resultado"
    })
    @ApiResponse({ status: 200, description: "Vista previa generada" })
    async renderPreview(
        @Param("id", ParseIntPipe) id: number,
        @Body() sampleData: Record<string, any>
    ) {
        return this.plantillasService.renderPreview(id, sampleData);
    }

    @Get(':id/versiones')
    @RequirePermissions("plantillas")
    @ApiOperation({ summary: 'Obtener historial de versiones de una plantilla' })
    async obtenerVersiones(@Param("id", ParseIntPipe) id: number) {
        return this.plantillasService.obtenerVersiones(id);
    }

    @Post(':id/versionar')
    @RequirePermissions("plantillas")
    @ApiOperation({ summary: 'Crear nueva versión manualmente (clonar)' })
    async versionar(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: any) {
        return this.plantillasService.crearNuevaVersionManual(id, user.id);
    }

    @Put(':id/activar')
    @RequirePermissions("plantillas")
    @ApiOperation({ summary: 'Activar una versión específica' })
    async activar(@Param("id", ParseIntPipe) id: number) {
        return this.plantillasService.activarVersion(id);
    }
}
