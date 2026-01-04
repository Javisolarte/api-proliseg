import { Controller, Get, UseGuards, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AutoservicioService } from './autoservicio.service';

@ApiTags('Autoservicio - Cliente')
@Controller('mi-contrato-cliente')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class AutoservicioClienteController {
    constructor(private readonly autoservicioService: AutoservicioService) { }

    @Get()
    @ApiOperation({ summary: 'Ver contratos comerciales del cliente (Activos e Inactivos)' })
    async getMiContratoCliente(@CurrentUser() user: any) {
        return this.autoservicioService.getMiContratoCliente(user.id);
    }

    @Get(':contratoId/detalle')
    @ApiOperation({ summary: 'Ver detalle de un contrato (Puestos y Vigilantes)' })
    async getDetalleContrato(@CurrentUser() user: any, @Param('contratoId') contratoId: number) {
        return this.autoservicioService.getDetalleContratoCliente(user.id, contratoId);
    }

    @Get(':contratoId/horarios')
    @ApiOperation({ summary: 'Ver horarios de personal en un contrato' })
    @ApiQuery({ name: 'fechaInicio', required: false })
    @ApiQuery({ name: 'fechaFin', required: false })
    async getHorariosContrato(
        @CurrentUser() user: any,
        @Param('contratoId') contratoId: number,
        @Query('fechaInicio') fechaInicio?: string,
        @Query('fechaFin') fechaFin?: string
    ) {
        return this.autoservicioService.getHorariosContratoCliente(user.id, contratoId, fechaInicio, fechaFin);
    }

    @Get('minutas')
    @ApiOperation({ summary: 'Ver minutas visibles para cliente' })
    async getMinutasCliente(@CurrentUser() user: any) {
        return this.autoservicioService.getMinutasCliente(user.id);
    }

    @Get('novedades')
    @ApiOperation({ summary: 'Ver novedades de los puestos del cliente' })
    async getNovedadesCliente(@CurrentUser() user: any) {
        return this.autoservicioService.getNovedadesCliente(user.id);
    }
}
