import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { DeduccionesNominaService } from './deducciones-nomina.service';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CreateDeduccionNominaDto } from './dto/create-deduccion-nomina.dto';
import { UpdateDeduccionNominaDto } from './dto/update-deduccion-nomina.dto';

@ApiTags('Nomina - Deducciones')
@Controller('nomina/deducciones')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class DeduccionesNominaController {
    constructor(private readonly deduccionesService: DeduccionesNominaService) { }

    @Post()
    @ApiOperation({ summary: 'Crear deduccion' })
    create(@Body() dto: CreateDeduccionNominaDto, @CurrentUser() user: any) {
        return this.deduccionesService.create(dto, user.id);
    }

    @Get()
    @ApiOperation({ summary: 'Listar todas las deducciones' })
    async findAll() {
        return this.deduccionesService.findAll();
    }

    @Get('activas')
    @ApiOperation({ summary: 'Listar solo deducciones activas (para calculo)' })
    async findActive() {
        return this.deduccionesService.findActive();
    }

    @Put(':id')
    @ApiOperation({ summary: 'Actualizar deduccion' })
    update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDeduccionNominaDto, @CurrentUser() user: any) {
        return this.deduccionesService.update(id, dto, user.id);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Eliminar deduccion' })
    remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
        return this.deduccionesService.remove(id, user.id);
    }
}
