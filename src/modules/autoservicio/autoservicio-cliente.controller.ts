import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
    @ApiOperation({ summary: 'Ver contrato comercial del cliente' })
    async getMiContratoCliente(@CurrentUser() user: any) {
        return this.autoservicioService.getMiContratoCliente(user.id);
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
