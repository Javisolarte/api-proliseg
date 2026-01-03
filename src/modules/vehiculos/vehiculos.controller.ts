import { Controller, Get, Post, Body, Param, Delete, Put, UseGuards } from '@nestjs/common';
import { VehiculosService } from './vehiculos.service';
import { CreateVehiculoDto } from './dto/create-vehiculo.dto';
import { UpdateVehiculoDto } from './dto/update-vehiculo.dto';
import { CreateAsignacionVehiculoDto } from './dto/create-asignacion-vehiculo.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Vehículos')
@Controller('vehiculos')
export class VehiculosController {
    constructor(private readonly vehiculosService: VehiculosService) { }

    @Post()
    @ApiOperation({ summary: 'Crear un nuevo vehículo' })
    @ApiResponse({ status: 201, description: 'Vehículo creado exitosamente.' })
    @ApiResponse({ status: 400, description: 'Datos inválidos o placa duplicada.' })
    create(@Body() createVehiculoDto: CreateVehiculoDto) {
        return this.vehiculosService.create(createVehiculoDto);
    }

    @Get()
    @ApiOperation({ summary: 'Listar todos los vehículos' })
    findAll() {
        return this.vehiculosService.findAll();
    }

    @Get(':id')
    @ApiOperation({ summary: 'Obtener un vehículo por ID' })
    findOne(@Param('id') id: string) {
        return this.vehiculosService.findOne(+id);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Actualizar un vehículo' })
    update(@Param('id') id: string, @Body() updateVehiculoDto: UpdateVehiculoDto) {
        return this.vehiculosService.update(+id, updateVehiculoDto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Eliminar un vehículo' })
    remove(@Param('id') id: string) {
        return this.vehiculosService.remove(+id);
    }
}

@ApiTags('Vehículos - Asignación')
@Controller('vehiculos-asignacion')
export class VehiculosAsignacionController {
    constructor(private readonly vehiculosService: VehiculosService) { }

    @Post()
    @ApiOperation({ summary: 'Asignar vehículo a un supervisor' })
    asignar(@Body() createAsignacionDto: CreateAsignacionVehiculoDto) {
        return this.vehiculosService.asignarVehiculo(createAsignacionDto);
    }

    @Get('turno/:turno_id')
    @ApiOperation({ summary: 'Obtener asignación de vehículo por turno' })
    getByTurno(@Param('turno_id') turnoId: string) {
        return this.vehiculosService.getAsignacionPorTurno(+turnoId);
    }

    @Get('vehiculo/:vehiculo_id')
    @ApiOperation({ summary: 'Historial de asignaciones de un vehículo' })
    getByVehiculo(@Param('vehiculo_id') vehiculoId: string) {
        return this.vehiculosService.getAsignacionPorVehiculo(+vehiculoId);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Eliminar asignación' })
    removeAsignacion(@Param('id') id: string) {
        return this.vehiculosService.removeAsignacion(+id);
    }
}
