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
  Req,
  BadRequestException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from "@nestjs/swagger";
import { EmpleadosService } from "./empleados.service";
import  { CreateEmpleadoDto, UpdateEmpleadoDto } from "./dto/empleado.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { Request } from "express";

@ApiTags("Empleados")
@Controller("empleados")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class EmpleadosController {
  constructor(private readonly empleadosService: EmpleadosService) {}

  /**
   * 🔹 Listar todos los empleados (sin filtros)
   */
  @Get()
  @RequirePermissions("empleados")
  @ApiOperation({ summary: "Listar todos los empleados (activos e inactivos)" })
  @ApiResponse({ status: 200, description: "Lista completa de empleados" })
  async findAll() {
    return this.empleadosService.findAll({});
  }

  /**
   * 🔹 Obtener empleado por ID
   */
  @Get(":id")
  @RequirePermissions("empleados")
  @ApiOperation({ summary: "Obtener empleado por ID" })
  @ApiResponse({ status: 200, description: "Empleado encontrado" })
  @ApiResponse({ status: 404, description: "Empleado no encontrado" })
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.empleadosService.findOne(id);
  }

  /**
   * 🔹 Crear nuevo empleado
   *
   * - Loggea el body crudo recibido (request.body) para debugging.
   * - Rechaza bodies no-objetos o arrays con 400.
   * - @ApiBody con ejemplo para que Swagger UI muestre el JSON por defecto.
   */
  @Post()
  @RequirePermissions("empleados")
  @ApiOperation({ summary: "Crear nuevo empleado" })
  @ApiResponse({ status: 201, description: "Empleado creado exitosamente" })
  @ApiResponse({ status: 400, description: "Bad Request - body inválido" })
  @ApiBody({
    description:
      "Objeto con los datos del empleado. Los campos nombre_completo, cedula y fecha_ingreso son obligatorios.",
    schema: {
      type: "object",
      example: {
        nombre_completo: "Juan Pérez García",
        cedula: "1234567890",
        fecha_ingreso: "2025-10-12",
        telefono: "3001234567",
        correo: "juan.perez@ejemplo.com",
        direccion: "Calle 123 #45-67",
        departamento: "Cundinamarca",
        ciudad: "Bogotá",
        estado_civil: "Soltero",
        genero: "Masculino",
        tipo_contrato: "Indefinido",
        puesto_trabajo_id: 1,
        eps_id: 1,
        arl_id: 1,
        fondo_pension_id: 1,
        horas_trabajadas_semana: 48,
        activo: true,
        rol_id: 2,
      },
    },
  })
  async create(
    @Req() request: Request,
    @Body() createEmpleadoDto: CreateEmpleadoDto,
    @CurrentUser() user: any
  ) {
    // --- Debug logs (crudo + transformado) ---
    console.log("📥 [Controller] request.body (raw):", request.body);
    console.log("📥 [Controller] createEmpleadoDto (after transform):", createEmpleadoDto);
    console.log("👤 [Controller] current user:", user && { id: user.id, email: user.email });

    // Validación primaria: request.body debe ser un objeto y no un array
    if (!request.body || typeof request.body !== "object" || Array.isArray(request.body)) {
      throw new BadRequestException("Request body inválido: se esperaba un objeto JSON.");
    }

    // Delegar al servicio (el servicio tendrá validaciones adicionales)
    return this.empleadosService.create(createEmpleadoDto, user.id);
  }

  /**
   * 🔹 Actualizar empleado existente
   */
  @Put(":id")
  @RequirePermissions("empleados")
  @ApiOperation({ summary: "Actualizar empleado" })
  @ApiResponse({ status: 200, description: "Empleado actualizado exitosamente" })
  @ApiResponse({ status: 400, description: "Bad Request - body inválido" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateEmpleadoDto: UpdateEmpleadoDto,
    @CurrentUser() user: any
  ) {
    // log minimal para debug
    console.log("✏️ [Controller] updateEmpleadoDto:", { id, payload: updateEmpleadoDto, updatedBy: user?.id });
    return this.empleadosService.update(id, updateEmpleadoDto, user.id);
  }

  /**
   * 🔹 Eliminar (soft delete)
   */
  @Delete(":id")
  @RequirePermissions("empleados")
  @ApiOperation({ summary: "Eliminar empleado (soft delete)" })
  @ApiResponse({ status: 200, description: "Empleado eliminado exitosamente" })
  async remove(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: any
  ) {
    console.log("🗑️ [Controller] softDelete empleado:", { id, deletedBy: user?.id });
    return this.empleadosService.softDelete(id, user.id);
  }

  /**
   * 🔹 Capacitaciones del empleado
   */
  @Get(":id/capacitaciones")
  @RequirePermissions("empleados", "capacitaciones")
  @ApiOperation({ summary: "Obtener capacitaciones de un empleado" })
  @ApiResponse({ status: 200, description: "Lista de capacitaciones" })
  async getCapacitaciones(@Param("id", ParseIntPipe) id: number) {
    return this.empleadosService.getCapacitaciones(id);
  }
}
        