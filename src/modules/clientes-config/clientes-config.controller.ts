import { Controller, Get, Put, Param, Body, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ClientesConfigService } from './clientes-config.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import type { ClienteConfiguracionDto } from './dto/cliente-config.dto';

@ApiTags('Client Configuration')
@Controller('api/clientes/:id/configuracion')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ClientesConfigController {
    constructor(private readonly configService: ClientesConfigService) { }

    @Get()
    @RequirePermissions('clientes', 'ver')
    @ApiOperation({ summary: 'Obtener configuración del cliente' })
    async obtener(@Param('id', ParseIntPipe) id: number) {
        return this.configService.obtenerConfiguracion(id);
    }

    @Put()
    @RequirePermissions('clientes', 'configurar')
    @ApiOperation({ summary: 'Actualizar configuración del cliente' })
    async actualizar(
        @Param('id', ParseIntPipe) id: number,
        @Body() config: ClienteConfiguracionDto
    ) {
        return this.configService.actualizarConfiguracion(id, config);
    }
}
