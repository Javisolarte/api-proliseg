import { Controller, Get, Post, Body, UseGuards, Logger, UseInterceptors, UploadedFile, Query, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiQuery } from '@nestjs/swagger';
import { ComunicacionesService } from './comunicaciones.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MensajeTextoDto } from './dto/comunicacion.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { SubirGrabacionDto } from './dto/subir-grabacion.dto';

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
     * 🌍 Obtener configuración ICE (TURN/STUN)
     */
    @Get('ice-servers')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Obtener servidores ICE (STUN/TURN) para WebRTC' })
    @ApiResponse({ status: 200, description: 'Lista de servidores ICE' })
    async getIceServers() {
        return this.comunicacionesService.getIceServers();
    }

    /**
     * 🚨 Endpoint de emergencia
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
     * 🎙️ Subir grabación de audio
     */
    @Post('subir-grabacion')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FileInterceptor('audio'))
    @ApiOperation({ summary: 'Subir grabación de audio al finalizar la comunicación' })
    async subirGrabacion(
        @UploadedFile('audio') file: any,
        @Body() dto: SubirGrabacionDto
    ) {
        // Logs de diagnóstico para saber qué falla exactamente
        this.logger.log(`📥 Petición de subida recibida. Sesión ID: ${dto?.sesion_id}`);
        this.logger.log(`📄 Estado del archivo (campo 'audio'): ${file ? 'RECIBIDO (' + file.originalname + ')' : 'NO ENCONTRADO (NULL)'}`);

        if (!file) {
            this.logger.error('❌ Error crítico: El archivo no llegó en el campo "audio".');
            this.logger.warn('💡 RECOMENDACIÓN: Asegúrate de que el frontend haga: formData.append("audio", blob, "audio.webm")');
            throw new Error('No se recibió el archivo de audio. Verifica el nombre del campo en el FormData (debe ser "audio").');
        }

        if (!file.buffer || file.buffer.length === 0) {
            this.logger.error(`❌ Error crítico: El archivo llegó pero el buffer está vacío.`);
            throw new Error('El archivo de audio está vacío o corrupto.');
        }

        return this.comunicacionesService.subirGrabacion(file, dto);
    }

    /**
     * 📜 Obtener historial
     */
    @Get('historial')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Obtener historial de grabaciones' })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'offset', required: false, type: Number })
    @ApiQuery({ name: 'empleado_id', required: false, type: Number })
    async getHistorial(
        @Query('limit') limit?: number,
        @Query('offset') offset?: number,
        @Query('empleado_id') empleado_id?: number
    ) {
        return this.comunicacionesService.getHistorial({
            limit: limit ? +limit : 10,
            offset: offset ? +offset : 0,
            empleado_id: empleado_id ? +empleado_id : undefined
        });
    }

    /**
     * 🔍 Obtener detalle de registro
     */
    @Get('historial/:id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Obtener detalle de una grabación específica' })
    async getHistorialDetalle(@Param('id') id: string) {
        return this.comunicacionesService.getHistorialDetalle(+id);
    }

    /**
     * 🗑️ Eliminar registro
     */
    @Delete('historial/:id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Eliminar un registro del historial y su archivo' })
    async eliminarHistorial(@Param('id') id: string) {
        return this.comunicacionesService.eliminarHistorial(+id);
    }

    /**
     * 🏥 Health check
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
