import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { SedesService } from './sedes.service';
import { CreateSedeDto, UpdateSedeDto } from './dto/sede.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Sedes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sedes')
export class SedesController {
    constructor(private readonly sedesService: SedesService) { }

    @Post()
    @ApiOperation({ summary: 'Crear una nueva sede' })
    @ApiResponse({ status: 201, description: 'Sede creada.' })
    create(@Body() createSedeDto: CreateSedeDto) {
        return this.sedesService.create(createSedeDto);
    }

    @Get()
    @ApiOperation({ summary: 'Obtener todas las sedes' })
    @ApiResponse({ status: 200, description: 'Lista de sedes.' })
    findAll() {
        return this.sedesService.findAll();
    }

    @Get(':id')
    @ApiOperation({ summary: 'Obtener sede por ID' })
    @ApiResponse({ status: 200, description: 'Datos de la sede.' })
    findOne(@Param('id') id: string) {
        return this.sedesService.findOne(+id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Actualizar una sede' })
    @ApiResponse({ status: 200, description: 'Sede actualizada.' })
    update(@Param('id') id: string, @Body() updateSedeDto: UpdateSedeDto) {
        return this.sedesService.update(+id, updateSedeDto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Eliminar una sede' })
    @ApiResponse({ status: 200, description: 'Sede eliminada.' })
    remove(@Param('id') id: string) {
        return this.sedesService.remove(+id);
    }
}
