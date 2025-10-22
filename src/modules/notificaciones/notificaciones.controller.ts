import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from "@nestjs/swagger";
import { NotificacionesService } from "./notificaciones.service";
import { CreateNotificacionDto, UpdateNotificacionDto } from "./dto/notificacion.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";

@ApiTags("Notificaciones")
@Controller("notificaciones")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

  @Get()
  @RequirePermissions("notificaciones")
  @ApiOperation({ summary: "Listar todas las notificaciones" })
  @ApiResponse({ status: 200, description: "Lista de notificaciones" })
  async findAll() {
    return this.notificacionesService.findAll();
  }

  @Get(":id")
  @RequirePermissions("notificaciones")
  @ApiOperation({ summary: "Obtener notificación por ID" })
  @ApiResponse({ status: 200, description: "Notificación encontrada" })
  @ApiResponse({ status: 404, description: "Notificación no encontrada" })
  async findOne(@Param("id") id: string) {
    return this.notificacionesService.findOne(Number(id));
  }

  @Post()
  @RequirePermissions("notificaciones")
  @ApiOperation({ summary: "Crear nueva notificación" })
  @ApiResponse({ status: 201, description: "Notificación creada exitosamente" })
  @ApiBody({ type: CreateNotificacionDto })
  async create(@Body() createNotificacionDto: CreateNotificacionDto) {
    return this.notificacionesService.create(createNotificacionDto);
  }

  @Put(":id")
  @RequirePermissions("notificaciones")
  @ApiOperation({ summary: "Actualizar notificación" })
  @ApiResponse({ status: 200, description: "Notificación actualizada correctamente" })
  async update(
    @Param("id") id: string,
    @Body() updateNotificacionDto: UpdateNotificacionDto,
  ) {
    return this.notificacionesService.update(Number(id), updateNotificacionDto);
  }

  @Delete(":id")
  @RequirePermissions("notificaciones")
  @ApiOperation({ summary: "Eliminar notificación" })
  @ApiResponse({ status: 200, description: "Notificación eliminada exitosamente" })
  async remove(@Param("id") id: string) {
    return this.notificacionesService.remove(Number(id));
  }
}
