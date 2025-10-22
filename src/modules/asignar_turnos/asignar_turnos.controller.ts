import { Controller, Post, Body, Get, Query, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AsignarTurnosService } from './asignar_turnos.service';
import { AsignarTurnosDto } from './dto/asignar_turnos.dto';

@ApiTags('Asignar Turnos')
@Controller('asignar-turnos')
export class AsignarTurnosController {
  constructor(private readonly asignarTurnosService: AsignarTurnosService) {}

  @Post()
  @ApiOperation({ summary: 'Asignar turnos a empleados según configuración' })
  async asignar(@Body() dto: AsignarTurnosDto) {
    return this.asignarTurnosService.asignarTurnos(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar turnos de un puesto (y opcional subpuesto)' })
  @ApiQuery({ name: 'puesto_id', type: Number })
  @ApiQuery({ name: 'subpuesto_id', type: Number, required: false })
  async listar(@Query('puesto_id') puesto_id: number, @Query('subpuesto_id') subpuesto_id?: number) {
    return this.asignarTurnosService.listarTurnos(puesto_id, subpuesto_id);
  }

  @Delete()
  @ApiOperation({ summary: 'Eliminar turnos programados de un puesto entre fechas' })
  @ApiQuery({ name: 'puesto_id', type: Number })
  @ApiQuery({ name: 'desde', type: String, description: 'Fecha inicio YYYY-MM-DD' })
  @ApiQuery({ name: 'hasta', type: String, description: 'Fecha fin YYYY-MM-DD' })
  async eliminar(
    @Query('puesto_id') puesto_id: number,
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
  ) {
    return this.asignarTurnosService.eliminarTurnos(puesto_id, desde, hasta);
  }
}
