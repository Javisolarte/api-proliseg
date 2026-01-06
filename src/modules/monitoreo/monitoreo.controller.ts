import { Controller, Post, Body, UseGuards, Ip } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MonitoreoService } from './monitoreo.service';
import { RegistrarUbicacionDto, DispararPanicoDto } from './dto/monitoreo.dto';

@ApiTags('Monitoreo y Seguridad')
@Controller('monitoreo')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class MonitoreoController {
    constructor(private readonly monitoreoService: MonitoreoService) { }

    @Post('ubicacion')
    @ApiOperation({ summary: 'Registrar ubicación en tiempo real (Empleados)' })
    async registrarUbicacion(
        @CurrentUser() user: any,
        @Body() dto: RegistrarUbicacionDto,
    ) {
        return this.monitoreoService.registrarUbicacion(dto, user.id);
    }

    @Post('panico')
    @ApiOperation({ summary: 'Activar Botón de Pánico (Empleados y Clientes)' })
    async dispararPanico(
        @CurrentUser() user: any,
        @Body() dto: DispararPanicoDto,
        @Ip() ipAddress: string,
    ) {
        return this.monitoreoService.dispararPanico(dto, user.id, ipAddress);
    }
}
