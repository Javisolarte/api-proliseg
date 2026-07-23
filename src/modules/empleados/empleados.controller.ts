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
  UploadedFile,
  Query,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiQuery,
} from "@nestjs/swagger";
import { FileFieldsInterceptor, FileInterceptor } from "@nestjs/platform-express";
import { EmpleadosService } from "./empleados.service";
import { CreateEmpleadoDto, UpdateEmpleadoDto } from "./dto/empleado.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";

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
  async findAll(
    @Query("activo") activo?: string,
    @Query("tipoEmpleadoId") tipoEmpleadoId?: string,
    @Query("resumen") resumen?: string,
  ) {
    return this.empleadosService.findAll({
      activo: activo === undefined ? undefined : activo === "true" || activo === "1",
      tipoEmpleadoId: tipoEmpleadoId ? Number(tipoEmpleadoId) : undefined,
      resumen: resumen === "true" || resumen === "1",
    });
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
   */
  @Post()
  @RequirePermissions("empleados")
  @ApiOperation({ summary: "Crear nuevo empleado" })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: "foto_perfil", maxCount: 1 },
      { name: "cedula_pdf", maxCount: 1 },
      { name: "hoja_de_vida", maxCount: 1 },
      { name: "certificado_bancario", maxCount: 1 },
      { name: "certificados", maxCount: 5 },
      { name: "documentos_adicionales", maxCount: 5 },
    ])
  )
  async create(
    @Req() request: Request,
    @Body() createEmpleadoDto: CreateEmpleadoDto,
    @UploadedFiles() files: any,
    @CurrentUser() user: any
  ) {
    return this.empleadosService.create(createEmpleadoDto, user?.id, files);
  }

  /**
   * 🔹 Actualizar empleado existente
   */
  @Put(":id")
  @RequirePermissions("empleados")
  @ApiOperation({ summary: "Actualizar empleado" })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: "foto_perfil", maxCount: 1 },
      { name: "cedula_pdf", maxCount: 1 },
      { name: "hoja_de_vida", maxCount: 1 },
      { name: "certificado_bancario", maxCount: 1 },
      { name: "certificados", maxCount: 5 },
      { name: "documentos_adicionales", maxCount: 5 },
    ])
  )
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateEmpleadoDto: UpdateEmpleadoDto,
    @UploadedFiles() files: any,
    @CurrentUser() user: any
  ) {
    return this.empleadosService.update(id, updateEmpleadoDto, user?.id, files);
  }

  /**
   * 🔹 Retirar empleado (Dar de baja)
   */
  @Put(":id/retirar")
  @RequirePermissions("empleados")
  @ApiOperation({ summary: "Retirar empleado (dar de baja)" })
  async retirar(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: { fecha_salida: string; motivo_salida: string; observacion_salida?: string },
    @CurrentUser() user: any
  ) {
    return this.empleadosService.retirarEmpleado(id, dto, user?.id);
  }

  /**
   * 🔹 Eliminar (soft delete)
   */
  @Delete(":id")
  @RequirePermissions("empleados")
  @ApiOperation({ summary: "Eliminar empleado (soft delete)" })
  async remove(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: any
  ) {
    return this.empleadosService.softDelete(id, user?.id);
  }

  /**
   * 🔹 Capacitaciones del empleado
   */
  @Get(":id/capacitaciones")
  @RequirePermissions("empleados", "capacitaciones")
  @ApiOperation({ summary: "Obtener capacitaciones de un empleado" })
  async getCapacitaciones(@Param("id", ParseIntPipe) id: number) {
    return this.empleadosService.getCapacitaciones(id);
  }

  /**
   * 🔹 Obtener salario del empleado
   */
  @Get(":id/salario")
  @RequirePermissions("empleados")
  @ApiOperation({ summary: "Obtener salario del empleado" })
  async getSalario(@Param("id", ParseIntPipe) id: number) {
    return this.empleadosService.getSalario(id);
  }

  /**
   * 🔹 Obtener rol del empleado
   */
  @Get(":id/rol")
  @RequirePermissions("empleados")
  @ApiOperation({ summary: "Obtener rol del empleado" })
  async getRol(@Param("id", ParseIntPipe) id: number) {
    return this.empleadosService.getRol(id);
  }

  /**
   * 🔹 Verificar si es vigilante
   */
  @Get(":id/es-vigilante")
  @RequirePermissions("empleados")
  @ApiOperation({ summary: "Verificar si es vigilante" })
  async isVigilante(@Param("id", ParseIntPipe) id: number) {
    return this.empleadosService.isVigilante(id);
  }

  /**
   * 🔹 Verificar si está asignado
   */
  @Get(":id/esta-asignado")
  @RequirePermissions("empleados")
  @ApiOperation({ summary: "Verificar si el empleado está asignado actualmente" })
  async checkAsignado(@Param("id", ParseIntPipe) id: number) {
    return this.empleadosService.checkAsignado(id);
  }

  /**
   * 🔹 Obtener empleados con el curso de vigilancia por vencer
   */
  @Get("consultas/cursos-por-vencer")
  @RequirePermissions("empleados")
  @ApiOperation({ summary: "Obtener empleados con el curso de vigilancia por vencer" })
  getCursosPorVencer(@Query("dias") dias?: string) {
    const numDias = dias ? parseInt(dias) : 30;
    return this.empleadosService.getCursosPorVencer(numDias);
  }

  /**
   * 🔹 Obtener tipo de vigilante
   */
  @Get("consultas/tipo-vigilante/:id")
  @RequirePermissions("empleados")
  @ApiOperation({ summary: "Obtener tipo de vigilante" })
  async getTipoVigilante(@Param("id", ParseIntPipe) id: number) {
    return this.empleadosService.getTipoVigilante(id);
  }

  /**
   * 🔹 Actualizar el orden de los empleados (Bulk)
   */
  @Post("update-order")
  @RequirePermissions("empleados")
  @ApiOperation({ summary: "Actualizar el orden de los empleados en bloque" })
  async updateOrder(@Body("orders") orders: { id: number; orden: number }[]) {
    return this.empleadosService.updateOrder(orders);
  }

  /**
   * 🔹 Subir documento individual a carpeta estructurada
   */
  @Post(":id/documentos-carpetas/upload")
  @RequirePermissions("empleados")
  @ApiOperation({ summary: "Subir documento individual a carpeta estructurada" })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file"))
  async uploadDocumentoCarpeta(
    @Param("id", ParseIntPipe) id: number,
    @Body("categoria") categoria: string,
    @Body("subclave") subclave: string,
    @UploadedFile() file: Express.Multer.File
  ) {
    return this.empleadosService.uploadDocumentoCarpeta(id, categoria, subclave, file);
  }
}
