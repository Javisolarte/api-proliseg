import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from "@nestjs/swagger";
import { AsignacionesService } from "./asignaciones.service";
import { CreateAsignacionDto, UpdateAsignacionDto } from "./dto/asignacion.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";

@ApiTags("Asignaciones de guardas")
@Controller("asignaciones")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class AsignacionesController {
  constructor(private readonly asignacionesService: AsignacionesService) { }

  @Get()
  @RequirePermissions("asignaciones")
  @ApiOperation({ summary: "Listar todas las asignaciones" })
  async findAll() {
    return this.asignacionesService.findAll();
  }

  @Get(":id")
  @RequirePermissions("asignaciones")
  @ApiOperation({ summary: "Obtener una asignación por ID" })
  async findOne(@Param("id") id: number) {
    return this.asignacionesService.findOne(id);
  }

  @Post()
  @RequirePermissions("asignaciones")
  @ApiOperation({ summary: "Crear nueva asignación" })
  @ApiBody({ type: CreateAsignacionDto })
  @ApiResponse({ status: 201, description: "Asignación creada exitosamente" })
  async create(@Body() dto: CreateAsignacionDto) {
    return this.asignacionesService.create(dto);
  }

  @Put(":id")
  @RequirePermissions("asignaciones")
  @ApiOperation({ summary: "Actualizar asignación existente" })
  @ApiBody({ type: UpdateAsignacionDto })
  async update(@Param("id") id: number, @Body() dto: UpdateAsignacionDto) {
    return this.asignacionesService.update(id, dto);
  }

  @Delete(":id")
  @RequirePermissions("asignaciones")
  @ApiOperation({
    summary: "Eliminar completamente una asignación",
    description: "Elimina permanentemente una asignación y TODOS los turnos relacionados. Esta operación no se puede deshacer."
  })
  @ApiResponse({
    status: 200,
    description: 'Asignación y turnos eliminados completamente',
    schema: {
      example: {
        message: "Asignación eliminada completamente",
        detalles: {
          asignacion_id: 1,
          empleado: "Juan Pérez",
          subpuesto: "Entrada Principal",
          turnos_eliminados: 42,
          empleado_desasignado: true
        }
      }
    }
  })
  async remove(@Param("id") id: number) {
    return this.asignacionesService.remove(id);
  }

  @Post(":id/desasignar")
  @RequirePermissions("asignaciones")
  @ApiOperation({
    summary: "Desasignar empleado de un subpuesto",
    description: "Desasigna un empleado de un subpuesto especificando el motivo. Los turnos futuros quedan pendientes de asignación y serán reasignados automáticamente cuando se asigne un nuevo empleado."
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['motivo'],
      properties: {
        motivo: {
          type: 'string',
          enum: ['renuncia', 'despido', 'cambio_lugar', 'incapacidad', 'otro'],
          description: 'Motivo de la desasignación'
        },
        motivo_detalle: {
          type: 'string',
          description: 'Detalles adicionales sobre el motivo (opcional)'
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Empleado desasignado exitosamente',
    schema: {
      example: {
        message: "Empleado desasignado exitosamente",
        asignacion: { id: 1, activo: false },
        turnos_pendientes: 25,
        detalles: {
          empleado: "Juan Pérez",
          subpuesto: "Entrada Principal",
          motivo: "renuncia",
          fecha_desasignacion: "2025-01-15",
          turnos_afectados: 25
        }
      }
    }
  })
  async desasignar(
    @Param("id") id: number,
    @Body("motivo") motivo: string,
    @Body("motivo_detalle") motivo_detalle?: string
  ) {
    return this.asignacionesService.desasignar(id, motivo, motivo_detalle);
  }

  @Post(":id/reemplazar")
  @RequirePermissions("asignaciones")
  @ApiOperation({
    summary: "Reemplazar empleado sin romper turnos",
    description: "Reemplaza un empleado por otro manteniendo todos los turnos futuros activos. Útil cuando un empleado renuncia y necesitas asignar un reemplazo inmediato."
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['nuevo_empleado_id', 'motivo'],
      properties: {
        nuevo_empleado_id: {
          type: 'number',
          description: 'ID del empleado que reemplazará al actual'
        },
        motivo: {
          type: 'string',
          enum: ['renuncia', 'despido', 'cambio_lugar', 'incapacidad', 'otro'],
          description: 'Motivo del reemplazo'
        },
        motivo_detalle: {
          type: 'string',
          description: 'Detalles adicionales sobre el motivo (opcional)'
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Empleado reemplazado exitosamente',
    schema: {
      example: {
        message: "Empleado reemplazado exitosamente sin romper turnos",
        asignacion_anterior: {
          id: 1,
          empleado: "Juan Pérez",
          activo: false
        },
        asignacion_nueva: {
          id: 2,
          empleado: "María García",
          activo: true
        },
        turnos_reasignados: 25,
        detalles: {
          subpuesto: "Entrada Principal",
          empleado_anterior: "Juan Pérez",
          empleado_nuevo: "María García",
          motivo: "renuncia",
          fecha_reemplazo: "2025-01-15",
          turnos_afectados: 25
        }
      }
    }
  })
  async reemplazar(
    @Param("id") id: number,
    @Body("nuevo_empleado_id") nuevoEmpleadoId: number,
    @Body("motivo") motivo: string,
    @Body("motivo_detalle") motivoDetalle?: string
  ) {
    return this.asignacionesService.reemplazarEmpleado(id, nuevoEmpleadoId, motivo, motivoDetalle);
  }
}
