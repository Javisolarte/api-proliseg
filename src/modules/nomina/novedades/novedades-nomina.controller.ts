import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { NovedadesNominaService } from './novedades-nomina.service';
import { CreateNovedadNominaDto } from './dto/create-novedad-nomina.dto';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';

@ApiTags('Nomina - Novedades')
@Controller('nomina/novedades')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('nomina')
@ApiBearerAuth('JWT-auth')
export class NovedadesNominaController {
    constructor(private readonly novedadesService: NovedadesNominaService) { }

    @Post()
    @ApiOperation({ summary: 'Registrar una novedad (incapacidad, licencia, sanción, etc.)' })
    create(@Body() dto: CreateNovedadNominaDto, @CurrentUser() user: any) {
        return this.novedadesService.create(dto, user.id);
    }

    @Get('periodo/:periodoId')
    @ApiOperation({ summary: 'Listar novedades registradas para un periodo' })
    findByPeriodo(@Param('periodoId', ParseIntPipe) periodoId: number) {
        return this.novedadesService.findByPeriodo(periodoId);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Eliminar una novedad' })
    remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
        return this.novedadesService.remove(id, user.id);
    }
}
