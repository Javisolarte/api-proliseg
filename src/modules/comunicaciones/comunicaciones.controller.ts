import { Controller, Get, Post, Body, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ComunicacionesService } from './comunicaciones.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MensajeTextoDto } from './dto/comunicacion.dto';

@ApiTags('Comunicaciones')
@Controller('comunicaciones')
export class ComunicacionesController {
    private readonly logger = new Logger(ComunicacionesController.name);

    constructor(private readonly comunicacionesService: ComunicacionesService) { }

    /**
     * 📊 Obtener estadísticas de comunicaciones activas
     */
    @Get('estadisticas')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Obtener estadísticas de comunicaciones en tiempo real' })
    @ApiResponse({ status: 200, description: 'Estadísticas obtenidas exitosamente' })
    async getEstadisticas() {
        return this.comunicacionesService.getEstadisticas();
    }

    /**
     * 🚨 Endpoint de emergencia (alternativo al WebSocket)
     */
    @Post('emergencia')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Enviar notificación de emergencia' })
    @ApiResponse({ status: 201, description: 'Emergencia notificada exitosamente' })
    async notificarEmergencia(@Body() data: MensajeTextoDto) {
        this.logger.warn(`🚨 Emergencia recibida de empleado ${data.empleado_id}`);

        await this.comunicacionesService.notificarEmergencia({
            empleado_id: data.empleado_id,
            mensaje: data.mensaje,
            puesto_id: data.puesto_id,
        });

        return {
            success: true,
            message: 'Emergencia notificada',
            timestamp: new Date(),
        };
    }

    /**
     * 🔍 Validar empleado
     */
    @Get('validar-empleado/:id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Validar que un empleado existe' })
    @ApiResponse({ status: 200, description: 'Empleado validado' })
    async validarEmpleado(@Body('empleado_id') empleado_id: number) {
        return this.comunicacionesService.validarEmpleado(empleado_id);
    }

    /**
     * 🏥 Health check del módulo
     */
    @Get('health')
    @ApiOperation({ summary: 'Verificar estado del módulo de comunicaciones' })
    @ApiResponse({ status: 200, description: 'Módulo operativo' })
    async healthCheck() {
        const stats = await this.comunicacionesService.getEstadisticas();

        return {
            status: 'ok',
            module: 'comunicaciones',
            sesiones_activas: stats.sesiones_activas,
            clientes_conectados: stats.clientes_conectados,
            timestamp: stats.timestamp,
        };
    }
}
