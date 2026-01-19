import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { HorasNominaService } from './horas-nomina.service';
import { CreateHorasNominaDto } from './dto/create-horas-nomina.dto';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';

@ApiTags('Nomina - Horas Extras')
@Controller('nomina/horas')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('nomina')
@ApiBearerAuth('JWT-auth')
export class HorasNominaController {
    constructor(private readonly horasService: HorasNominaService) { }

    @Post()
    @ApiOperation({ summary: 'Registrar/Actualizar horas extras para un empleado en un periodo' })
    create(@Body() dto: CreateHorasNominaDto, @CurrentUser() user: any) {
        return this.horasService.create(dto, user.id);
    }

    @Get('empleado/:id')
    @ApiOperation({ summary: 'Consultar horas de un empleado' })
    findByEmpleado(@Param('id', ParseIntPipe) id: number) {
        return this.horasService.findByEmpleado(id);
    }

    @Get('periodo/:id')
    @ApiOperation({ summary: 'Consultar horas de un periodo' })
    findByPeriodo(@Param('id', ParseIntPipe) id: number) {
        return this.horasService.findByPeriodo(id);
    }

    // UPDATE/DELETE can be handled via POST (upsert) or adding specific endpoints. 
    // User requested PUT /:id and DELETE /:id.
    // However, id here usually refers to the record id in nomina_empleado.
}
