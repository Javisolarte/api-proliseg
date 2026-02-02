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
import { CotizacionesService } from "./cotizaciones.service";
import { CreateCotizacionDto, UpdateCotizacionDto, CreateCotizacionItemDto } from "./dto/cotizacion.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";

@ApiTags("Cotizaciones")
@Controller("cotizaciones")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class CotizacionesController {
    constructor(private readonly cotizacionesService: CotizacionesService) { }

    @Get()
    @RequirePermissions("cotizaciones")
    @ApiOperation({ summary: "Listar cotizaciones" })
    @ApiQuery({ name: "cliente_id", required: false, type: Number })
    @ApiQuery({ name: "estado", required: false })
    @ApiResponse({ status: 200, description: "Lista de cotizaciones" })
    async findAll(
        @Query("cliente_id") cliente_id?: string,
        @Query("estado") estado?: string
    ) {
        const filters: any = {};
        if (cliente_id) filters.cliente_id = parseInt(cliente_id);
        if (estado) filters.estado = estado;

        return this.cotizacionesService.findAll(filters);
    }

    @Get(":id")
    @RequirePermissions("cotizaciones")
    @ApiOperation({ summary: "Obtener cotización por ID" })
    @ApiResponse({ status: 200, description: "Cotización encontrada" })
    async findOne(@Param("id", ParseIntPipe) id: number) {
        return this.cotizacionesService.findOne(id);
    }

    @Post()
    @RequirePermissions("cotizaciones", "crear")
    @ApiOperation({ summary: "Crear cotización" })
    @ApiResponse({ status: 201, description: "Cotización creada" })
    async create(
        @Body() createDto: CreateCotizacionDto,
        @CurrentUser() user: any
    ) {
        return this.cotizacionesService.create(createDto, user);
    }

    @Put(":id")
    @RequirePermissions("cotizaciones", "actualizar")
    @ApiOperation({ summary: "Actualizar cotización" })
    @ApiResponse({ status: 200, description: "Cotización actualizada" })
    async update(
        @Param("id", ParseIntPipe) id: number,
        @Body() updateDto: UpdateCotizacionDto,
        @CurrentUser() user: any
    ) {
        return this.cotizacionesService.update(id, updateDto, user.id);
    }

    @Post(":id/aprobar")
    @RequirePermissions("cotizaciones", "aprobar")
    @ApiOperation({ summary: "Aprobar cotización" })
    @ApiResponse({ status: 200, description: "Cotización aprobada" })
    async aprobar(
        @Param("id", ParseIntPipe) id: number,
        @CurrentUser() user: any
    ) {
        return this.cotizacionesService.aprobar(id, user.id);
    }

    // 🟢 BLOQUE 3 - State Transitions
    @Post(":id/enviar")
    @RequirePermissions("cotizaciones", "enviar")
    @ApiOperation({ summary: "Enviar cotización al cliente" })
    @ApiResponse({ status: 200, description: "Cotización enviada exitosamente" })
    async enviar(
        @Param("id", ParseIntPipe) id: number,
        @CurrentUser() user: any
    ) {
        return this.cotizacionesService.enviar(id, user.id);
    }

    @Post(":id/aceptar")
    @RequirePermissions("cotizaciones", "aceptar")
    @ApiOperation({ summary: "Aceptar cotización" })
    @ApiResponse({ status: 200, description: "Cotización aceptada" })
    async aceptar(
        @Param("id", ParseIntPipe) id: number,
        @CurrentUser() user: any
    ) {
        return this.cotizacionesService.aceptar(id, user.id);
    }

    @Post(":id/rechazar")
    @RequirePermissions("cotizaciones", "rechazar")
    @ApiOperation({ summary: "Rechazar cotización" })
    @ApiResponse({ status: 200, description: "Cotización rechazada" })
    async rechazar(
        @Param("id", ParseIntPipe) id: number,
        @Body("motivo") motivo: string,
        @CurrentUser() user: any
    ) {
        return this.cotizacionesService.rechazar(id, motivo, user.id);
    }

    @Post(":id/expirar")
    @RequirePermissions("cotizaciones", "expirar")
    @ApiOperation({ summary: "Expirar cotización" })
    @ApiResponse({ status: 200, description: "Cotización expirada" })
    async expirar(
        @Param("id", ParseIntPipe) id: number,
        @CurrentUser() user: any
    ) {
        return this.cotizacionesService.expirar(id, user.id);
    }

    @Get(":id/items")
    @RequirePermissions("cotizaciones")
    @ApiOperation({ summary: "Obtener items de cotización" })
    @ApiResponse({ status: 200, description: "Lista de items" })
    async getItems(@Param("id", ParseIntPipe) id: number) {
        return this.cotizacionesService.getItems(id);
    }

    @Post("items")
    @RequirePermissions("cotizaciones", "crear")
    @ApiOperation({ summary: "Agregar item a cotización" })
    @ApiResponse({ status: 201, description: "Item creado" })
    async createItem(@Body() createItemDto: CreateCotizacionItemDto) {
        return this.cotizacionesService.createItem(createItemDto.cotizacion_id, createItemDto);
    }

    @Delete("items/:id")
    @RequirePermissions("cotizaciones", "eliminar")
    @ApiOperation({ summary: "Eliminar item de cotización" })
    @ApiResponse({ status: 200, description: "Item eliminado" })
    async deleteItem(@Param("id", ParseIntPipe) id: number) {
        return this.cotizacionesService.deleteItem(id);
    }

    @Post(":id/convertir-contrato")
    @RequirePermissions("cotizaciones", "aprobar") // Requiere permisos altos
    @ApiOperation({ summary: "Convertir cotización en contrato" })
    async convertirContrato(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: any) {
        return this.cotizacionesService.convertirAContrato(id, user.id);
    }

    @Get(":id/pdf")
    @RequirePermissions("cotizaciones")
    @ApiOperation({ summary: "Descargar PDF de cotización" })
    async getPdf(@Param("id", ParseIntPipe) id: number) {
        return this.cotizacionesService.generarPdf(id);
    }
}
