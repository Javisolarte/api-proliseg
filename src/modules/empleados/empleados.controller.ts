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
  UseInterceptors,
  UploadedFiles,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
} from "@nestjs/swagger";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { EmpleadosService } from "./empleados.service";
import { CreateEmpleadoDto, UpdateEmpleadoDto } from "./dto/empleado.dto";
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
  constructor(private readonly empleadosService: EmpleadosService) { }

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
  @ApiOperation({
    summary: "Crear nuevo empleado",
    description: `Crea un nuevo empleado con datos personales y archivos adjuntos.
    
**Archivos soportados:**
- 📸 **foto_perfil**: Foto del empleado (JPG, PNG) - Se guarda como: cedula.ext
- 📄 **cedula_pdf**: Cédula escaneada (PDF) - Se guarda como: cedula.pdf
- 📋 **hoja_de_vida**: Hoja de vida (PDF) - Se guarda como: cedula.pdf
- 🎓 **certificados**: Múltiples certificados (PDF, hasta 5) - Se guardan como: cedula_cert1.pdf, cedula_cert2.pdf, etc.
- 📎 **documentos_adicionales**: Otros documentos (PDF, hasta 5) - Se guardan como: cedula_doc1.pdf, cedula_doc2.pdf, etc.

Todos los archivos se guardan en buckets de Supabase Storage y se sobrescriben si ya existen.`
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        // Campos de texto del DTO
        usuario_id: { type: 'number', example: 1 },
        nombre_completo: { type: 'string', example: 'Juan Pérez García' },
        cedula: { type: 'string', example: '1234567890' },
        fecha_expedicion: { type: 'string', format: 'date', example: '2020-01-15' },
        fecha_nacimiento: { type: 'string', format: 'date', example: '1990-05-20' },
        telefono: { type: 'string', example: '3001234567' },
        correo: { type: 'string', format: 'email', example: 'juan.perez@ejemplo.com' },
        direccion: { type: 'string', example: 'Calle 123 #45-67' },
        departamento: { type: 'string', example: 'Cundinamarca' },
        ciudad: { type: 'string', example: 'Bogotá' },
        estado_civil: { type: 'string', example: 'Soltero' },
        genero: { type: 'string', example: 'Masculino' },
        tipo_contrato: { type: 'string', example: 'Indefinido' },
        fecha_ingreso: { type: 'string', format: 'date', example: '2023-01-01' },
        fecha_salida: { type: 'string', format: 'date', example: '2024-01-01' },
        motivo_salida: { type: 'string', example: 'Renuncia voluntaria' },
        puesto_id: { type: 'number', example: 1 },
        eps_id: { type: 'number', example: 1 },
        arl_id: { type: 'number', example: 1 },
        fondo_pension_id: { type: 'number', example: 1 },
        salario_id: { type: 'number', example: 1 },
        formacion_academica: { type: 'string', example: 'Bachiller' },
        rol: { type: 'string', example: 'empleado' },
        activo: { type: 'boolean', example: true },
        // Campos de archivos
        foto_perfil: { type: 'string', format: 'binary', description: '📸 Foto de perfil (JPG, PNG)' },
        cedula_pdf: { type: 'string', format: 'binary', description: '📄 Cédula escaneada (PDF)' },
        hoja_de_vida: { type: 'string', format: 'binary', description: '📋 Hoja de vida (PDF)' },
        certificados: { type: 'array', items: { type: 'string', format: 'binary' }, description: '🎓 Certificados (hasta 5 PDFs)' },
        documentos_adicionales: { type: 'array', items: { type: 'string', format: 'binary' }, description: '📎 Documentos adicionales (hasta 5 PDFs)' },
      },
      required: ['nombre_completo', 'cedula', 'fecha_ingreso']
    }
  })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: "foto_perfil", maxCount: 1 },
      { name: "cedula_pdf", maxCount: 1 },
      { name: "hoja_de_vida", maxCount: 1 },
      { name: "certificados", maxCount: 5 },
      { name: "documentos_adicionales", maxCount: 5 },
    ])
  )
  @ApiResponse({ status: 201, description: "Empleado creado exitosamente con archivos subidos" })
  @ApiResponse({ status: 400, description: "Bad Request - body inválido o archivos no válidos" })
  async create(
    @Req() request: Request,
    @Body() createEmpleadoDto: CreateEmpleadoDto,
    @UploadedFiles() files: {
      foto_perfil?: any[];
      cedula_pdf?: any[];
      hoja_de_vida?: any[];
      certificados?: any[];
      documentos_adicionales?: any[];
    },
    @CurrentUser() user: any
  ) {
    // --- Debug logs (crudo + transformado) ---
    console.log("📥 [Controller] request.body (raw):", request.body);
    console.log("📥 [Controller] createEmpleadoDto (after transform):", createEmpleadoDto);
    console.log("📂 [Controller] files:", files ? Object.keys(files) : "No files");
    console.log("👤 [Controller] current user:", user && { id: user.id, email: user.email });

    // Validación primaria: request.body debe ser un objeto y no un array
    if (!request.body || typeof request.body !== "object" || Array.isArray(request.body)) {
      throw new BadRequestException("Request body inválido: se esperaba un objeto JSON.");
    }

    // Delegar al servicio (el servicio tendrá validaciones adicionales)
    return this.empleadosService.create(createEmpleadoDto, user.id, files);
  }

  /**
   * 🔹 Actualizar empleado existente
   */
  @Put(":id")
  @RequirePermissions("empleados")
  @ApiOperation({
    summary: "Actualizar empleado",
    description: `Actualiza un empleado existente. Los archivos subidos reemplazan los existentes.
    
**Archivos soportados:**
- 📸 **foto_perfil**: Nueva foto (reemplaza la anterior)
- 📄 **cedula_pdf**: Nueva cédula (reemplaza la anterior)
- 📋 **hoja_de_vida**: Nueva hoja de vida (reemplaza la anterior)
- 🎓 **certificados**: Nuevos certificados (se agregan a los existentes)
- 📎 **documentos_adicionales**: Nuevos documentos (se agregan a los existentes)`
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        // Campos de texto (todos opcionales en update)
        nombre_completo: { type: 'string', example: 'Juan Pérez García' },
        telefono: { type: 'string', example: '3001234567' },
        correo: { type: 'string', format: 'email', example: 'juan.perez@ejemplo.com' },
        direccion: { type: 'string', example: 'Calle 123 #45-67' },
        departamento: { type: 'string', example: 'Cundinamarca' },
        ciudad: { type: 'string', example: 'Bogotá' },
        salario_id: { type: 'number', example: 1 },
        formacion_academica: { type: 'string', example: 'Técnico' },
        activo: { type: 'boolean', example: true },
        // Campos de archivos
        foto_perfil: { type: 'string', format: 'binary', description: '📸 Nueva foto de perfil' },
        cedula_pdf: { type: 'string', format: 'binary', description: '📄 Nueva cédula' },
        hoja_de_vida: { type: 'string', format: 'binary', description: '📋 Nueva hoja de vida' },
        certificados: { type: 'array', items: { type: 'string', format: 'binary' }, description: '🎓 Nuevos certificados (se agregan)' },
        documentos_adicionales: { type: 'array', items: { type: 'string', format: 'binary' }, description: '📎 Nuevos documentos (se agregan)' },
      }
    }
  })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: "foto_perfil", maxCount: 1 },
      { name: "cedula_pdf", maxCount: 1 },
      { name: "hoja_de_vida", maxCount: 1 },
      { name: "certificados", maxCount: 5 },
      { name: "documentos_adicionales", maxCount: 5 },
    ])
  )
  @ApiResponse({ status: 200, description: "Empleado actualizado exitosamente con archivos subidos" })
  @ApiResponse({ status: 400, description: "Bad Request - body inválido o archivos no válidos" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateEmpleadoDto: UpdateEmpleadoDto,
    @UploadedFiles() files: {
      foto_perfil?: any[];
      cedula_pdf?: any[];
      hoja_de_vida?: any[];
      certificados?: any[];
      documentos_adicionales?: any[];
    },
    @CurrentUser() user: any
  ) {
    // log minimal para debug
    console.log("✏️ [Controller] updateEmpleadoDto:", { id, payload: updateEmpleadoDto, updatedBy: user?.id });
    console.log("📂 [Controller] files:", files ? Object.keys(files) : "No files");
    return this.empleadosService.update(id, updateEmpleadoDto, user.id, files);
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
