import {
    Controller,
    Get,
    Post,
    Body,
    Put,
    Param,
    Delete,
    UseGuards,
    ParseIntPipe,
} from '@nestjs/common';
import { TiposVigilanteService } from './tipos-vigilante.service';
import { CreateTipoVigilanteDto } from './dto/create-tipo-vigilante.dto';
import { UpdateTipoVigilanteDto } from './dto/update-tipo-vigilante.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Tipos de Vigilante')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('tipos-vigilante')
export class TiposVigilanteController {
    constructor(private readonly tiposVigilanteService: TiposVigilanteService) { }

    @Post()
    @RequirePermissions('tipos_vigilante')
    @ApiOperation({ summary: 'Crear un nuevo tipo de vigilante' })
    @ApiResponse({ status: 201, description: 'Tipo de vigilante creado exitosamente.' })
    create(@Body() createTipoVigilanteDto: CreateTipoVigilanteDto) {
        return this.tiposVigilanteService.create(createTipoVigilanteDto);
    }

    @Get()
    @RequirePermissions('tipos_vigilante')
    @ApiOperation({ summary: 'Listar todos los tipos de vigilante' })
    @ApiResponse({ status: 200, description: 'Lista de tipos de vigilante.' })
    findAll() {
        return this.tiposVigilanteService.findAll();
    }

    @Get(':id')
    @RequirePermissions('tipos_vigilante')
    @ApiOperation({ summary: 'Obtener un tipo de vigilante por ID' })
    @ApiResponse({ status: 200, description: 'Tipo de vigilante encontrado.' })
    @ApiResponse({ status: 404, description: 'Tipo de vigilante no encontrado.' })
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.tiposVigilanteService.findOne(id);
    }

    @Put(':id')
    @RequirePermissions('tipos_vigilante')
    @ApiOperation({ summary: 'Actualizar un tipo de vigilante' })
    @ApiResponse({ status: 200, description: 'Tipo de vigilante actualizado exitosamente.' })
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateTipoVigilanteDto: UpdateTipoVigilanteDto,
    ) {
        return this.tiposVigilanteService.update(id, updateTipoVigilanteDto);
    }

    @Delete(':id')
    @RequirePermissions('tipos_vigilante')
    @ApiOperation({ summary: 'Eliminar un tipo de vigilante' })
    @ApiResponse({ status: 200, description: 'Tipo de vigilante eliminado exitosamente.' })
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.tiposVigilanteService.remove(id);
    }
}
