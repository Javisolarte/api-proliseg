import { Controller, Get, Post, Body, Param, Delete, Put, UseGuards, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { VehiculosService } from './vehiculos.service';
import { CreateVehiculoDto } from './dto/create-vehiculo.dto';
import { UpdateVehiculoDto } from './dto/update-vehiculo.dto';
import { CreateAsignacionVehiculoDto } from './dto/create-asignacion-vehiculo.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';

@ApiTags('Vehículos')
@Controller('vehiculos')
export class VehiculosController {
    constructor(private readonly vehiculosService: VehiculosService) { }

    @Post()
    @ApiOperation({ summary: 'Crear un nuevo vehículo con archivos' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                tipo: { type: 'string', example: 'moto' },
                placa: { type: 'string', example: 'ABC-123' },
                marca: { type: 'string', example: 'Yamaha' },
                modelo: { type: 'string', example: 'XTZ 125' },
                cilindraje: { type: 'number', example: 125 },
                tarjeta_propietario: { type: 'string', example: '123456789' },
                soat_vencimiento: { type: 'string', format: 'date', example: '2024-12-31' },
                tecnomecanica_vencimiento: { type: 'string', format: 'date', example: '2024-12-31' },
                activo: { type: 'boolean', example: true },
                soat: { type: 'string', format: 'binary', description: 'Documento SOAT' },
                tecnomecanica: { type: 'string', format: 'binary', description: 'Documento Tecnomecánica' },
                tarjeta_propiedad: { type: 'string', format: 'binary', description: 'Tarjeta de Propiedad' },
            },
            required: ['tipo', 'placa', 'tarjeta_propietario', 'soat_vencimiento', 'tecnomecanica_vencimiento']
        }
    })
    @UseInterceptors(
        FileFieldsInterceptor([
            { name: 'soat', maxCount: 1 },
            { name: 'tecnomecanica', maxCount: 1 },
            { name: 'tarjeta_propiedad', maxCount: 1 },
        ])
    )
    @ApiResponse({ status: 201, description: 'Vehículo creado exitosamente.' })
    @ApiResponse({ status: 400, description: 'Datos inválidos o placa duplicada.' })
    create(
        @Body() createVehiculoDto: CreateVehiculoDto,
        @UploadedFiles() files: {
            soat?: any[];
            tecnomecanica?: any[];
            tarjeta_propiedad?: any[];
        }
    ) {
        return this.vehiculosService.create(createVehiculoDto, files);
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
    @ApiOperation({ summary: 'Actualizar un vehículo con archivos' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                tipo: { type: 'string', example: 'moto' },
                placa: { type: 'string', example: 'ABC-123' },
                marca: { type: 'string', example: 'Yamaha' },
                modelo: { type: 'string', example: 'XTZ 125' },
                cilindraje: { type: 'number', example: 125 },
                tarjeta_propietario: { type: 'string', example: '123456789' },
                soat_vencimiento: { type: 'string', format: 'date', example: '2024-12-31' },
                tecnomecanica_vencimiento: { type: 'string', format: 'date', example: '2024-12-31' },
                activo: { type: 'boolean', example: true },
                soat: { type: 'string', format: 'binary', description: 'Nuevo documento SOAT' },
                tecnomecanica: { type: 'string', format: 'binary', description: 'Nuevo documento Tecnomecánica' },
                tarjeta_propiedad: { type: 'string', format: 'binary', description: 'Nueva Tarjeta de Propiedad' },
            }
        }
    })
    @UseInterceptors(
        FileFieldsInterceptor([
            { name: 'soat', maxCount: 1 },
            { name: 'tecnomecanica', maxCount: 1 },
            { name: 'tarjeta_propiedad', maxCount: 1 },
        ])
    )
    update(
        @Param('id') id: string,
        @Body() updateVehiculoDto: UpdateVehiculoDto,
        @UploadedFiles() files: {
            soat?: any[];
            tecnomecanica?: any[];
            tarjeta_propiedad?: any[];
        }
    ) {
        return this.vehiculosService.update(+id, updateVehiculoDto, files);
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
