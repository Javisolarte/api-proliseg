import { Controller, Get, Post, Body, Patch, Param, UseGuards, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PqrsfService } from './pqrsf.service';
import { CreatePqrsfDto, UpdatePqrsfDto, AddRespuestaDto, AddAdjuntoDto } from './dto/pqrsf.dto';

@ApiTags('PQRSF')
@Controller('pqrsf')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class PqrsfController {
    constructor(private readonly pqrsfService: PqrsfService) { }

    @Post()
    @ApiOperation({ summary: 'Crear un nuevo PQRSF' })
    create(@Body() createPqrsfDto: CreatePqrsfDto, @CurrentUser() user: any) {
        return this.pqrsfService.create(createPqrsfDto, user.id);
    }

    @Get()
    @ApiOperation({ summary: 'Listar PQRSF con filtros' })
    @ApiQuery({ name: 'clienteId', required: false })
    @ApiQuery({ name: 'estado', required: false })
    @ApiQuery({ name: 'fechaInicio', required: false })
    @ApiQuery({ name: 'fechaFin', required: false })
    findAll(
        @Query('clienteId') clienteId?: number,
        @Query('estado') estado?: string,
        @Query('fechaInicio') fechaInicio?: string,
        @Query('fechaFin') fechaFin?: string
    ) {
        return this.pqrsfService.findAll({ clienteId, estado, fechaInicio, fechaFin });
    }

    @Get(':id')
    @ApiOperation({ summary: 'Obtener detalle de un PQRSF' })
    findOne(@Param('id') id: number) {
        return this.pqrsfService.findOne(id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Actualizar estado o prioridad de un PQRSF' })
    update(@Param('id') id: number, @Body() updatePqrsfDto: UpdatePqrsfDto, @CurrentUser() user: any) {
        return this.pqrsfService.update(id, updatePqrsfDto, user.id);
    }

    @Post(':id/respuestas')
    @ApiOperation({ summary: 'Agregar respuesta a un PQRSF' })
    addRespuesta(@Param('id') id: number, @Body() addRespuestaDto: AddRespuestaDto, @CurrentUser() user: any) {
        return this.pqrsfService.addRespuesta(id, addRespuestaDto, user.id);
    }

    @Post(':id/adjuntos')
    @ApiOperation({ summary: 'Agregar archivo adjunto a un PQRSF' })
    addAdjunto(@Param('id') id: number, @Body() addAdjuntoDto: AddAdjuntoDto, @CurrentUser() user: any) {
        return this.pqrsfService.addAdjunto(id, addAdjuntoDto, user.id);
    }
}
