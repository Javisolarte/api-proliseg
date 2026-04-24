import { Controller, Get, Post, Body, UseGuards, Logger, UseInterceptors, UploadedFile, Query, Param, Delete, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiQuery } from '@nestjs/swagger';
import { ComunicacionesService } from './comunicaciones.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MensajeTextoDto } from './dto/comunicacion.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { SubirGrabacionDto } from './dto/subir-grabacion.dto';

import { LiveKitService } from './livekit.service';

@ApiTags('Comunicaciones')
@Controller('comunicaciones')
export class ComunicacionesController {
    private readonly logger = new Logger(ComunicacionesController.name);

    constructor(
        private readonly comunicacionesService: ComunicacionesService,
        private readonly liveKitService: LiveKitService
    ) { }

    @Get('canales')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Listar canales de radio (salas) activos' })
    async listarCanales() {
        return this.liveKitService.listRooms();
    }

    @Delete('canales/:name')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Cerrar un canal de radio' })
    async cerrarCanal(@Param('name') name: string) {
        return this.liveKitService.deleteRoom(name);
    }

    @Get('canales/:name/participantes')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Ver participantes de un canal' })
    async listarParticipantes(@Param('name') name: string) {
        return this.liveKitService.listParticipants(name);
    }

    @Get('puestos')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Listar todos los puestos (canales predefinidos)' })
    async getCanalesPuestos() {
        return this.comunicacionesService.getCanalesPuestos();
    }

    @Post('puestos')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Crear un nuevo puesto (canal)' })
    async crearCanalPuesto(@Body() data: any) {
        return this.comunicacionesService.crearCanalPuesto(data);
    }

    @Post('puestos/:id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Actualizar un puesto (canal)' })
    async actualizarCanalPuesto(@Param('id') id: string, @Body() data: any) {
        return this.comunicacionesService.actualizarCanalPuesto(+id, data);
    }

    @Delete('puestos/:id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Eliminar un puesto (canal)' })
    async eliminarCanalPuesto(@Param('id') id: string) {
        return this.comunicacionesService.eliminarCanalPuesto(+id);
    }

    @Get('empleados-online')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Ver lista detallada de empleados online' })
    async getEmpleadosOnline() {
        return this.comunicacionesService.getEmpleadosOnlineDetalle();
    }

    @Get('estadisticas')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    async getEstadisticas() {
        return this.comunicacionesService.getEstadisticas();
    }

    @Get('ice-servers')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    async getIceServers() {
        return this.comunicacionesService.getIceServers();
    }

    @Post('emergencia')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    async notificarEmergencia(@Body() data: MensajeTextoDto) {
        await this.comunicacionesService.notificarEmergencia(data);
        return { success: true };
    }

    /**
     * 🎙️ Subir grabación de audio
     */
    @Post('subir-grabacion')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FileInterceptor('audio'))
    @ApiOperation({ summary: 'Subir grabación de audio' })
    async subirGrabacion(
        @UploadedFile('audio') file: any,
        @Body() dto: SubirGrabacionDto,
        @Request() req: any
    ) {
        // DIAGNÓSTICO
        const finalFile = file || req.file;

        this.logger.log(`📥 Subida: Sesion=${dto.sesion_id}, FilePresent=${!!finalFile}`);

        if (!finalFile || !finalFile.buffer) {
            // Depuración extrema: ¿Llegó algo en req.files (plural)?
            if (req.files) {
                this.logger.warn(`🔍 Se encontraron archivos con otros nombres: ${Object.keys(req.files).join(',')}`);
            }
            throw new Error('Archivo de audio no encontrado. Asegúrate de enviarlo en el campo "audio".');
        }

        return this.comunicacionesService.subirGrabacion(finalFile, dto);
    }

    @Get('historial')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
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

    @Get('historial/:id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    async getHistorialDetalle(@Param('id') id: string) {
        return this.comunicacionesService.getHistorialDetalle(+id);
    }

    @Delete('historial/:id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    async eliminarHistorial(@Param('id') id: string) {
        return this.comunicacionesService.eliminarHistorial(+id);
    }

    @Get('health')
    async healthCheck() {
        const stats = await this.comunicacionesService.getEstadisticas();
        return { status: 'ok', module: 'comunicaciones', sessions: stats.comunicaciones_activas };
    }
}
