import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  UseGuards,
  ParseIntPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from "@nestjs/swagger";
import { ServiciosService } from "./servicios.service";
import { CreateServicioDto, UpdateServicioDto } from "./dto/servicio.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";

@ApiTags("Servicios")
@Controller("servicios")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class ServiciosController {
  constructor(private readonly serviciosService: ServiciosService) {}

  /**
   * 🔹 Crear un nuevo servicio
   */
  @Post()
  @RequirePermissions("servicios")
  @ApiOperation({ summary: "Crear un nuevo servicio" })
  @ApiResponse({ status: 201, description: "Servicio creado exitosamente" })
  @ApiBody({
    description: "Datos necesarios para crear un servicio",
    schema: {
      type: "object",
      example: {
        nombre: "Vigilancia 24/7",
        categoria: "Seguridad física",
        descripcion: "Servicio de vigilancia diurna y nocturna",
        modalidad: "12h diurna",
        valor_base: 1200000,
        activo: true,
      },
    },
  })
  async crear(
    @Body() dto: CreateServicioDto,
    @CurrentUser() user: any
  ) {
    console.log("🆕 [Controller] Crear servicio:", dto, "por usuario:", user?.id);
    return await this.serviciosService.crear(dto, user.id);
  }

  /**
   * 🔹 Listar todos los servicios
   */
  @Get()
  @RequirePermissions("servicios")
  @ApiOperation({ summary: "Listar todos los servicios" })
  @ApiResponse({ status: 200, description: "Lista completa de servicios" })
  async listar() {
    return await this.serviciosService.listar();
  }

  /**
   * 🔹 Obtener un servicio por su ID
   */
  @Get(":id")
  @RequirePermissions("servicios")
  @ApiOperation({ summary: "Obtener un servicio por su ID" })
  async obtenerPorId(@Param("id", ParseIntPipe) id: number) {
    return await this.serviciosService.obtenerPorId(id);
  }

  /**
   * 🔹 Actualizar un servicio existente
   */
  @Patch(":id")
  @RequirePermissions("servicios")
  @ApiOperation({ summary: "Actualizar un servicio existente" })
  async actualizar(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateServicioDto,
    @CurrentUser() user: any
  ) {
    console.log("✏️ [Controller] Actualizar servicio:", { id, dto, actualizado_por: user?.id });
    return await this.serviciosService.actualizar(id, dto, user.id);
  }

  /**
   * 🔹 Eliminar (lógicamente) un servicio
   */
  @Delete(":id")
  @RequirePermissions("servicios")
  @ApiOperation({ summary: "Eliminar (lógicamente) un servicio" })
  async eliminar(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: any) {
    console.log("🗑️ [Controller] Eliminar servicio:", { id, eliminado_por: user?.id });
    return await this.serviciosService.eliminar(id, user.id);
  }

  /**
   * 🔹 Sembrar servicios base
   */
  @Post("seed")
  @RequirePermissions("servicios")
  @ApiOperation({ summary: "Cargar servicios base por defecto" })
  async seed() {
    return await this.serviciosService.seedServiciosBase();
  }
}
