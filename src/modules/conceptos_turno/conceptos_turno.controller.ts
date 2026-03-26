import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConceptosTurnoService } from './conceptos_turno.service';
import { CreateConceptoTurnoDto, UpdateConceptoTurnoDto } from './dto/conceptos_turno.dto';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Conceptos de Turno')
@Controller('conceptos-turno')
@ApiBearerAuth()
export class ConceptosTurnoController {
  constructor(private readonly conceptosTurnoService: ConceptosTurnoService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Obtener todos los conceptos de turno' })
  findAll() {
    return this.conceptosTurnoService.findAll();
  }

  @Get(':codigo')
  @ApiOperation({ summary: 'Obtener un concepto por su código' })
  findOne(@Param('codigo') codigo: string) {
    return this.conceptosTurnoService.findByCodigo(codigo);
  }

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo concepto de turno' })
  create(@Body() dto: CreateConceptoTurnoDto) {
    return this.conceptosTurnoService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un concepto de turno' })
  update(@Param('id') id: string, @Body() dto: UpdateConceptoTurnoDto) {
    return this.conceptosTurnoService.update(+id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un concepto de turno' })
  remove(@Param('id') id: string) {
    return this.conceptosTurnoService.remove(+id);
  }
}
