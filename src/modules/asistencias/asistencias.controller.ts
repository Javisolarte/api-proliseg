import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from "@nestjs/common";
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
        puesto: "Edificio Central"
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
        }
      }
    }
  })
  async registrarSalida(@Body() dto: RegistrarSalidaDto) {
    return this.asistenciasService.registrarSalida(dto);
  }

  @Get("turnos-habilitados")
  @RequirePermissions("asistencia.read")
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
  @RequirePermissions("asistencia.read")
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
  @RequirePermissions("asistencia.read")
  @ApiOperation({ summary: "Listar asistencias por empleado" })
  @ApiQuery({ name: "empleado_id", type: Number, required: true })
  async findAll(@Query("empleado_id", ParseIntPipe) empleado_id: number) {
    return this.asistenciasService.findAllByEmpleado(empleado_id);
  }
}
