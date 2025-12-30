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
import { TiposCursoVigilanciaService } from './tipos-curso-vigilancia.service';
import { CreateTipoCursoVigilanciaDto } from './dto/create-tipo-curso-vigilancia.dto';
import { UpdateTipoCursoVigilanciaDto } from './dto/update-tipo-curso-vigilancia.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Vigilancia')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('tipos-curso-vigilancia')
export class TiposCursoVigilanciaController {
    constructor(private readonly tiposCursoVigilanciaService: TiposCursoVigilanciaService) { }

    @Post()
    @RequirePermissions('tipos_curso_vigilancia')
    @ApiOperation({ summary: 'Crear un nuevo tipo de curso de vigilancia' })
    @ApiResponse({ status: 201, description: 'Tipo de curso de vigilancia creado exitosamente.' })
    create(@Body() createTipoCursoVigilanciaDto: CreateTipoCursoVigilanciaDto) {
        return this.tiposCursoVigilanciaService.create(createTipoCursoVigilanciaDto);
    }

    @Get()
    @RequirePermissions('tipos_curso_vigilancia')
    @ApiOperation({ summary: 'Listar todos los tipos de curso de vigilancia' })
    @ApiResponse({ status: 200, description: 'Lista de tipos de curso de vigilancia.' })
    findAll() {
        return this.tiposCursoVigilanciaService.findAll();
    }

    @Get(':id')
    @RequirePermissions('tipos_curso_vigilancia')
    @ApiOperation({ summary: 'Obtener un tipo de curso de vigilancia por ID' })
    @ApiResponse({ status: 200, description: 'Tipo de curso de vigilancia encontrado.' })
    @ApiResponse({ status: 404, description: 'Tipo de curso de vigilancia no encontrado.' })
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.tiposCursoVigilanciaService.findOne(id);
    }

    @Put(':id')
    @RequirePermissions('tipos_curso_vigilancia')
    @ApiOperation({ summary: 'Actualizar un tipo de curso de vigilancia' })
    @ApiResponse({ status: 200, description: 'Tipo de curso de vigilancia actualizado exitosamente.' })
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateTipoCursoVigilanciaDto: UpdateTipoCursoVigilanciaDto,
    ) {
        return this.tiposCursoVigilanciaService.update(id, updateTipoCursoVigilanciaDto);
    }

    @Delete(':id')
    @RequirePermissions('tipos_curso_vigilancia')
    @ApiOperation({ summary: 'Eliminar un tipo de curso de vigilancia' })
    @ApiResponse({ status: 200, description: 'Tipo de curso de vigilancia eliminado exitosamente.' })
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.tiposCursoVigilanciaService.remove(id);
    }
}
