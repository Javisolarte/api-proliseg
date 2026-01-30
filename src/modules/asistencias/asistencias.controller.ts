import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { AsistenciasService } from "./asistencias.service";
import { RegistrarEntradaDto } from "./dto/registrar_entrada.dto";
import { RegistrarSalidaDto } from "./dto/registrar_salida.dto";
import { UpdateAsistenciaDto, CerrarTurnoManualDto, RegistrarEntradaManualDto, RegistrarSalidaManualDto } from "./dto/asistencias.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";

@ApiTags("Asistencias")
@Controller("asistencias")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class AsistenciasController {
  constructor(private readonly asistenciasService: AsistenciasService) { }

  @Post("entrada")
  @RequirePermissions("asistencia.write")
  @ApiOperation({
    summary: "Registrar entrada con geolocalización",
    description: "Registra la entrada de un empleado a su turno. Solo se permite si el empleado está asignado al subpuesto del turno."
  })
  @ApiResponse({
    status: 201,
    description: "Entrada registrada exitosamente",
    schema: {
      example: {
        message: "✅ Entrada registrada correctamente",
        analisis_ia: "Entrada normal, sin anomalías detectadas",
        distancia_metros: 15.5,
        asistencia: {
          id: 1,
          empleado_id: 10,
          turno_id: 100,
          tipo_marca: "entrada",
          timestamp: "2025-01-15T08:00:00Z"
        },
        subpuesto: "Entrada Principal",
        puesto: "Edificio Central",
        observaciones_generadas: "Llegada tarde: 5 min. | IA: Entrada normal, sin anomalías detectadas"
      }
    }
  })
  async registrarEntrada(@Body() dto: RegistrarEntradaDto) {
    return this.asistenciasService.registrarEntrada(dto);
  }

  @Post("salida")
  @RequirePermissions("asistencia.write")
  @ApiOperation({
    summary: "Registrar salida con geolocalización",
    description: "Registra la salida de un empleado de su turno. Requiere que exista un registro de entrada previo."
  })
  @ApiResponse({
    status: 201,
    description: "Salida registrada exitosamente",
    schema: {
      example: {
        message: "✅ Salida registrada correctamente",
        analisis_ia: "Salida normal",
        distancia_metros: 12.3,
        asistencia: {
          id: 2,
          empleado_id: 10,
          turno_id: 100,
          tipo_marca: "salida",
          timestamp: "2025-01-15T16:00:00Z"
        },
        observaciones_salida: "Salida Normal. | IA: Salida normal"
      }
    }
  })
  async registrarSalida(@Body() dto: RegistrarSalidaDto) {
    return this.asistenciasService.registrarSalida(dto);
  }

  @Get("turnos-habilitados")
  @RequirePermissions("asistencias.read")
  @ApiOperation({
    summary: "Obtener turnos con asistencias habilitadas",
    description: "Lista los turnos donde el empleado puede registrar asistencias (solo turnos de subpuestos donde está asignado)"
  })
  @ApiQuery({ name: "empleado_id", type: Number, description: "ID del empleado" })
  @ApiQuery({ name: "fecha", type: String, required: false, description: "Fecha específica (YYYY-MM-DD)" })
  @ApiResponse({
    status: 200,
    description: "Lista de turnos habilitados",
    schema: {
      example: [
        {
          id: 100,
          fecha: "2025-01-15",
          hora_inicio: "08:00:00",
          hora_fin: "16:00:00",
          tipo_turno: "DIA",
          estado_turno: "programado",
          subpuesto: {
            id: 5,
            nombre: "Entrada Principal",
            puesto: {
              id: 1,
              nombre: "Edificio Central",
              direccion: "Cra 10 #25-30",
              ciudad: "Cali"
            }
          },
          asistencia_habilitada: true,
          asistencias: []
        }
      ]
    }
  })
  async obtenerTurnosHabilitados(
    @Query("empleado_id", ParseIntPipe) empleado_id: number,
    @Query("fecha") fecha?: string
  ) {
    return this.asistenciasService.obtenerTurnosHabilitados(empleado_id, fecha);
  }

  @Get("metricas")
  @RequirePermissions("asistencias.read")
  @ApiOperation({
    summary: "Obtener métricas de cumplimiento",
    description: "Calcula métricas de cumplimiento de asistencias de los últimos 30 días"
  })
  @ApiResponse({
    status: 200,
    description: "Métricas de cumplimiento",
    schema: {
      example: {
        message: "📈 Métrica de cumplimiento generada correctamente",
        cumplimiento: {
          total_turnos: 100,
          turnos_con_entrada: 95,
          turnos_con_salida: 90,
          porcentaje_cumplimiento: "95.00"
        }
      }
    }
  })
  async obtenerMetricaCumplimiento() {
    return this.asistenciasService.obtenerMetricaCumplimiento();
  }

  @Get()
  @RequirePermissions("asistencias.read")
  @ApiOperation({ summary: "Listar asistencias por empleado" })
  @ApiQuery({ name: "empleado_id", type: Number, required: true })
  @ApiResponse({
    status: 200,
    description: "Lista de registros de asistencia del empleado",
    schema: {
      example: [
        {
          id: 1,
          empleado_id: 10,
          turno_id: 100,
          hora_entrada: "2025-01-15T08:00:00Z",
          hora_salida: "2025-01-15T16:00:00Z",
          estado_asistencia: "cumplido",
          turno: { id: 100, fecha: "2025-01-15", subpuesto: { nombre: "Entrada" } }
        }
      ]
    }
  })
  async findAll(@Query("empleado_id", ParseIntPipe) empleado_id: number) {
    return this.asistenciasService.findAllByEmpleado(empleado_id);
  }

  @Patch(":id")
  @RequirePermissions("asistencia.write")
  @ApiOperation({ summary: "Actualizar registro de asistencia" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateAsistenciaDto
  ) {
    return this.asistenciasService.update(id, dto);
  }

  @Delete(":id")
  @RequirePermissions("asistencia.write")
  @ApiOperation({ summary: "Eliminar registro de asistencia" })
  async remove(@Param("id", ParseIntPipe) id: number) {
    return this.asistenciasService.remove(id);
  }

  @Post("cerrar-turno")
  @RequirePermissions("asistencia.write")
  @ApiOperation({ summary: "Cerrar turno manualmente (Admin/Supervisor)" })
  async cerrarTurnoManual(@Body() dto: CerrarTurnoManualDto) {
    return this.asistenciasService.cerrarTurnoManual(dto);
  }

  @Get("turnos/:turno_id/resumen")
  @RequirePermissions("asistencias.read")
  @ApiOperation({ summary: "Obtener resumen calculado del turno" })
  @ApiResponse({
    status: 200,
    description: "Resumen de horas y métricas laborales del turno",
    schema: {
      example: {
        horas_totales: 8.5,
        minutos_totales: 510,
        horas_nocturnas: 2.0,
        horas_diurnas: 6.5,
        horas_extras: 0.5,
        horas_normales: 8.0,
        dominical: false,
        festivo: false,
        minutos_tolerancia: 5,
        estado: "cumplido"
      }
    }
  })
  async getTurnoResumen(@Param("turno_id", ParseIntPipe) turno_id: number) {
    return this.asistenciasService.getTurnoResumen(turno_id);
  }

  @Get("empleado/:id/laboral")
  @RequirePermissions("asistencias.read")
  @ApiOperation({ summary: "Obtener historial laboral detallado del empleado" })
  @ApiResponse({
    status: 200,
    description: "Historial de turnos con métricas calculadas",
    schema: {
      example: [
        {
          id: 1,
          turno_id: 100,
          hora_entrada: "2025-01-15T08:00:00Z",
          hora_salida: "2025-01-15T16:30:00Z",
          estado_asistencia: "cumplido",
          tiempo_total_horas: 8.5,
          horas_extras: 0.5,
          turno: { fecha: "2025-01-15", subpuesto: { nombre: "Entrada" } }
        }
      ]
    }
  })
  async getHistorialLaboral(@Param("id", ParseIntPipe) id: number) {
    return this.asistenciasService.getHistorialLaboral(id);
  }

  @Get("puestos")
  @RequirePermissions("asistencias.read")
  @ApiOperation({ summary: "Listar puestos que tienen registros de asistencia" })
  @ApiResponse({
    status: 200,
    description: "Lista de puestos con resumen de asistencias",
    schema: {
      example: [
        { id: 1, nombre: "Edificio Central", direccion: "Calle 1", total_asistencias: 15 }
      ]
    }
  })
  async getPuestosConAsistencia() {
    return this.asistenciasService.getPuestosConAsistencia();
  }

  @Get("puesto/:puesto_id")
  @RequirePermissions("asistencias.read")
  @ApiOperation({ summary: "Listar asistencias filtradas por puesto" })
  @ApiQuery({ name: "fecha_inicio", required: false, type: String, description: "Fecha inicio ISO" })
  @ApiQuery({ name: "fecha_fin", required: false, type: String, description: "Fecha fin ISO" })
  @ApiResponse({
    status: 200,
    description: "Asistencias del puesto con detalles de empleado y turno",
    schema: {
      example: [
        {
          id: 1,
          empleado_id: 10,
          empleado: { nombre_completo: "Juan Perez" },
          turno: { fecha: "2025-01-15", subpuesto: { nombre: "Entrada", puesto: { nombre: "Edificio Central" } } }
        }
      ]
    }
  })
  async getAsistenciasByPuesto(
    @Param("puesto_id", ParseIntPipe) puesto_id: number,
    @Query("fecha_inicio") fecha_inicio?: string,
    @Query("fecha_fin") fecha_fin?: string
  ) {
    return this.asistenciasService.getAsistenciasByPuesto(puesto_id, fecha_inicio, fecha_fin);
  }

  @Get("monitoreo")
  @RequirePermissions("asistencias.read")
  @ApiOperation({ summary: "Monitoreo en tiempo real de los turnos de hoy" })
  @ApiResponse({
    status: 200,
    description: "Resumen y detalle del monitoreo",
    schema: {
      example: {
        resumen: {
          total: 10,
          en_sitio: 5,
          completados: 2,
          tarde: 1,
          ausentes: 2,
          pendientes_iniciar: 0,
          novedades: [{ empleado: "Juan Perez", puesto: "Puesto A", tipo: "Inasistencia", desde: "08:00:00" }]
        },
        detalle: [{
          turno_id: 100,
          empleado: "Juan Perez",
          puesto: "Puesto A",
          subpuesto: "Entrada",
          hora_inicio: "08:00:00",
          hora_fin: "16:00:00",
          status: "ausente",
          hora_entrada: null
        }]
      }
    }
  })
  async getMonitoreoHoy() {
    return this.asistenciasService.getMonitoreoHoy();
  }

  @Post("entrada-manual")
  @RequirePermissions("asistencia.write")
  @ApiOperation({
    summary: "Registrar entrada manual (Super Usuario)",
    description: "Registra la entrada sin validar geolocalización. Solo para Admin/Supervisor."
  })
  @ApiResponse({
    status: 201,
    description: "Entrada manual registrada",
    schema: {
      example: {
        message: "✅ Entrada manual registrada exitosamente.",
        asistencia: { id: 1, empleado_id: 1, turno_id: 10, hora_entrada: "2025-01-15T08:00:00Z" }
      }
    }
  })
  async registrarEntradaManual(@Body() dto: RegistrarEntradaManualDto) {
    return this.asistenciasService.registrarEntradaManual(dto);
  }

  @Post("salida-manual")
  @RequirePermissions("asistencia.write")
  @ApiOperation({
    summary: "Registrar salida manual (Super Usuario)",
    description: "Registra la salida sin validar geolocalización. Solo para Admin/Supervisor."
  })
  @ApiResponse({
    status: 201,
    description: "Salida manual registrada",
    schema: {
      example: {
        message: "✅ Salida manual registrada exitosamente.",
        asistencia: { id: 1, empleado_id: 1, turno_id: 10, hora_salida: "2025-01-15T16:00:00Z" }
      }
    }
  })
  async registrarSalidaManual(@Body() dto: RegistrarSalidaManualDto) {
    return this.asistenciasService.registrarSalidaManual(dto);
  }

  @Post("upload-foto")
  @RequirePermissions("asistencia.write")
  @ApiOperation({ summary: "Subir foto de evidencia (Entrada/Salida)" })
  @UseInterceptors(FileInterceptor('file'))
  @ApiResponse({
    status: 201,
    description: "Foto subida correctamente",
    schema: {
      example: {
        url: "https://supabase.../asistencias-fotos/123.jpg"
      }
    }
  })
  async uploadFoto(
    @UploadedFile() file: Express.Multer.File,
    @Body("empleado_id") empleado_id: string
  ) {
    return this.asistenciasService.uploadFoto(file, parseInt(empleado_id));
  }
}
