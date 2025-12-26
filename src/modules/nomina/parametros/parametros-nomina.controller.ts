import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ParametrosNominaService } from './parametros-nomina.service';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CreateParametroNominaDto } from './dto/create-parametro-nomina.dto';
import { UpdateParametroNominaDto } from './dto/update-parametro-nomina.dto';

@ApiTags('Nomina - Parametros')
@Controller('nomina/parametros')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ParametrosNominaController {
    constructor(private readonly parametrosService: ParametrosNominaService) { }

    @Post()
    @ApiOperation({ summary: 'Crear parametro' })
    create(@Body() dto: CreateParametroNominaDto, @CurrentUser() user: any) {
        return this.parametrosService.create(dto, user.id);
    }

    @Get()
    @ApiOperation({ summary: 'Listar todos los parametros' })
    async findAll(@Query('anio') anio?: number) {
        return this.parametrosService.findAll(anio);
    }

    @Get(':year')
    @ApiOperation({ summary: 'Listar parametros por año' })
    async findByYear(@Param('year', ParseIntPipe) year: number) {
        return this.parametrosService.findByYear(year);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Actualizar parametro' })
    update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateParametroNominaDto, @CurrentUser() user: any) {
        return this.parametrosService.update(id, dto, user.id);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Eliminar parametro' })
    remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
        return this.parametrosService.remove(id, user.id);
    }

    @Post('clonar/:year')
    @ApiOperation({ summary: 'Clonar parametros de un año al siguiente' })
    clone(@Param('year', ParseIntPipe) year: number, @CurrentUser() user: any) {
        return this.parametrosService.clone(year, user.id);
    }
}
