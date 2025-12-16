import { Controller, Post, Body, Get, Query, Delete, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { AsignarTurnosService } from './asignar_turnos.service';
import { AsignarTurnosDto } from './dto/asignar_turnos.dto';

@ApiTags('Asignar Turnos')
@Controller('asignar-turnos')
export class AsignarTurnosController {
  constructor(private readonly asignarTurnosService: AsignarTurnosService) { }

  @Post()
  @ApiOperation({
    summary: 'Generar turnos para un subpuesto',
    description: 'Genera turnos automáticamente para todos los empleados asignados a un subpuesto, usando la configuración de turnos del subpuesto. Los turnos se generan por 30 días incluyendo días de descanso según el ciclo configurado.'
  })
  @ApiResponse({
    status: 201,
    description: 'Turnos generados exitosamente',
    schema: {
      example: {
        message: 'Turnos generados exitosamente',
        total_turnos: 90,
        empleados: 3,
        dias: 30,
        subpuesto: 'Subpuesto A - Entrada Principal',
        configuracion: '2D-2N-2Z'
      }
    }
  })
  async asignar(@Body() dto: AsignarTurnosDto) {
    return this.asignarTurnosService.asignarTurnos(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar turnos de un subpuesto',
    description: 'Lista todos los turnos generados para un subpuesto específico, con filtros opcionales de fecha'
  })
  @ApiQuery({ name: 'subpuesto_id', type: Number, description: 'ID del subpuesto' })
  @ApiQuery({ name: 'desde', type: String, required: false, description: 'Fecha inicio (YYYY-MM-DD)' })
  @ApiQuery({ name: 'hasta', type: String, required: false, description: 'Fecha fin (YYYY-MM-DD)' })
  async listar(
    @Query('subpuesto_id', ParseIntPipe) subpuesto_id: number,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string
  ) {
    return this.asignarTurnosService.listarTurnos(subpuesto_id, desde, hasta);
  }

  @Delete()
  @ApiOperation({
    summary: 'Eliminar turnos programados de un subpuesto',
    description: 'Elimina turnos en estado "programado" de un subpuesto en un rango de fechas específico'
  })
  @ApiQuery({ name: 'subpuesto_id', type: Number, description: 'ID del subpuesto' })
  @ApiQuery({ name: 'desde', type: String, description: 'Fecha inicio (YYYY-MM-DD)' })
  @ApiQuery({ name: 'hasta', type: String, description: 'Fecha fin (YYYY-MM-DD)' })
  @ApiResponse({
    status: 200,
    description: 'Turnos eliminados exitosamente',
    schema: {
      example: {
        message: 'Se eliminaron 30 turnos programados',
        eliminados: 30
      }
    }
  })
  async eliminar(
    @Query('subpuesto_id', ParseIntPipe) subpuesto_id: number,
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
  ) {
    return this.asignarTurnosService.eliminarTurnos(subpuesto_id, desde, hasta);
  }

  @Post('automatico')
  @ApiOperation({
    summary: 'Generar turnos automáticamente para todos los subpuestos',
    description: 'Genera turnos automáticamente para todos los subpuestos activos que tengan configuración de turnos y no tengan turnos generados para el mes actual'
  })
  @ApiResponse({
    status: 201,
    description: 'Generación automática completada',
    schema: {
      example: {
        generados: 5,
        omitidos: 2
      }
    }
  })
  async generarAutomatico() {
    return this.asignarTurnosService.generarTurnosAutomaticos();
  }

  @Post('rotar')
  @ApiOperation({
    summary: 'Rotar turnos entre empleados',
    description: 'Rota los turnos entre empleados de un subpuesto. El primer empleado toma los turnos del segundo, el segundo los del tercero, y así sucesivamente. El último empleado toma los turnos del primero. Solo modifica los turnos existentes, no crea nuevos.'
  })
  @ApiQuery({ name: 'subpuesto_id', type: Number, description: 'ID del subpuesto' })
  @ApiQuery({ name: 'desde', type: String, description: 'Fecha inicio (YYYY-MM-DD)' })
  @ApiQuery({ name: 'hasta', type: String, description: 'Fecha fin (YYYY-MM-DD)' })
  @ApiResponse({
    status: 201,
    description: 'Turnos rotados exitosamente',
    schema: {
      example: {
        message: '✅ Turnos rotados exitosamente',
        turnos_rotados: 90,
        turnos_fallidos: 0,
        empleados_involucrados: 3,
        rotacion: [
          {
            empleado: 'Juan Pérez',
            toma_turnos_de: 'María González'
          },
          {
            empleado: 'María González',
            toma_turnos_de: 'Carlos López'
          },
          {
            empleado: 'Carlos López',
            toma_turnos_de: 'Juan Pérez'
          }
        ]
      }
    }
  })
  async rotar(
    @Query('subpuesto_id', ParseIntPipe) subpuesto_id: number,
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
  ) {
    return this.asignarTurnosService.rotarTurnos(subpuesto_id, desde, hasta);
  }
}
