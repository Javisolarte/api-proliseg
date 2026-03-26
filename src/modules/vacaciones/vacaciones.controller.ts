import { Controller, Get, Post, Body, Patch, Param, Delete, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { VacacionesService } from './vacaciones.service';
import { CreateVacacionDto, UpdateVacacionDto } from './dto/vacaciones.dto';

@ApiTags('Vacaciones')
@Controller('vacaciones')
@ApiBearerAuth()
export class VacacionesController {
  constructor(private readonly vacacionesService: VacacionesService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener todas las vacaciones' })
  findAll() {
    return this.vacacionesService.findAll();
  }

  @Get('proximas')
  @ApiOperation({ summary: 'Obtener próximas vacaciones sugeridas (60 días o menos)' })
  getProximas() {
    return this.vacacionesService.getProximasVacacionesSugeridas();
  }

  @Get('empleado/:id')
  @ApiOperation({ summary: 'Obtener vacaciones por empleado' })
  findByEmpleado(@Param('id') id: string) {
    return this.vacacionesService.findByEmpleado(+id);
  }

  @Post()
  @ApiOperation({ summary: 'Registrar nuevas vacaciones' })
  create(@Body() dto: CreateVacacionDto, @Request() req: any) {
    // req.user.id if using JwtAuthGuard
    return this.vacacionesService.create(dto, req.user?.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar registro de vacaciones' })
  update(@Param('id') id: string, @Body() dto: UpdateVacacionDto) {
    return this.vacacionesService.update(+id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar registro de vacaciones' })
  remove(@Param('id') id: string) {
    return this.vacacionesService.remove(+id);
  }
}
