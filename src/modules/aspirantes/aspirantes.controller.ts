import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AspirantesService } from './aspirantes.service';
import { CreatePruebaDto } from './dto/create-prueba.dto';
import { CreatePreguntaDto } from './dto/create-pregunta.dto';
import { CreateAspiranteDto } from './dto/create-aspirante.dto';
import { ProgramarIntentoDto, ReprogramarIntentoDto } from './dto/programar-intento.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Aspirantes (Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('aspirantes')
@Controller('aspirantes')
export class AspirantesController {
    constructor(private readonly aspirantesService: AspirantesService) { }

    // ==========================================
    // PRUEBAS & PREGUNTAS
    // ==========================================

    @Post('pruebas')
    @ApiOperation({ summary: 'Crear una nueva prueba técnica/psicotécnica' })
    @ApiResponse({ status: 201, description: 'Prueba creada exitosamente' })
    createPrueba(@Body() dto: CreatePruebaDto, @CurrentUser() user: any) {
        // Ajustar segun estructura de user
        const userId = user?.id;
        if (!dto.creada_por && userId) dto.creada_por = userId;
        return this.aspirantesService.createPrueba(dto);
    }

    @Get('pruebas')
    @ApiOperation({ summary: 'Listar todas las pruebas creadas' })
    findAllPruebas() {
        return this.aspirantesService.findAllPruebas();
    }

    @Delete('pruebas/:id')
    @ApiOperation({ summary: 'Eliminar una prueba (Cascade: borra preguntas e intentos)' })
    deletePrueba(@Param('id') id: string) {
        return this.aspirantesService.deletePrueba(+id);
    }

    @Post('preguntas')
    @ApiOperation({ summary: 'Agregar una pregunta con opciones a una prueba' })
    createPregunta(@Body() dto: CreatePreguntaDto) {
        return this.aspirantesService.createPregunta(dto);
    }

    @Delete('preguntas/:id')
    @ApiOperation({ summary: 'Eliminar una pregunta' })
    deletePregunta(@Param('id') id: string) {
        return this.aspirantesService.deletePregunta(+id);
    }

    // ==========================================
    // ASPIRANTES
    // ==========================================

    @Post('candidatos')
    @ApiOperation({ summary: 'Registrar o actualizar un aspirante' })
    @ApiResponse({ status: 201, description: 'Aspirante registrado. Si ya existe, retorna sus datos.' })
    registerAspirante(@Body() dto: CreateAspiranteDto) {
        return this.aspirantesService.registerAspirante(dto);
    }

    @Get('candidatos')
    @ApiOperation({ summary: 'Listar todos los aspirantes' })
    findAllAspirantes() {
        return this.aspirantesService.findAllAspirantes();
    }

    @Get('candidatos/:id')
    @ApiOperation({ summary: 'Obtener detalle de un aspirante e historial' })
    findOneAspirante(@Param('id') id: string) {
        return this.aspirantesService.findOneAspirante(+id);
    }

    @Delete('candidatos/:id')
    @ApiOperation({ summary: 'Eliminar un aspirante' })
    deleteAspirante(@Param('id') id: string) {
        return this.aspirantesService.deleteAspirante(+id);
    }

    // ==========================================
    // PROGRAMACIÓN & INTENTOS
    // ==========================================

    @Post('agendar')
    @ApiOperation({ summary: 'Programar un intento de prueba para un aspirante' })
    @ApiResponse({ status: 201, description: 'Retorna link y token generado' })
    scheduleIntento(@Body() dto: ProgramarIntentoDto) {
        return this.aspirantesService.scheduleIntento(dto);
    }

    @Post('intentos/:id/reprogramar')
    @ApiOperation({ summary: 'Reprogramar fecha/hora/lugar de un intento' })
    rescheduleIntento(@Param('id') id: string, @Body() dto: ReprogramarIntentoDto) {
        return this.aspirantesService.rescheduleIntento(+id, dto);
    }

    @Get('intentos/:id')
    @ApiOperation({ summary: 'Ver detalle completo de un intento' })
    getIntento(@Param('id') id: string) {
        return this.aspirantesService.getIntento(+id);
    }

    @Delete('intentos/:id')
    @ApiOperation({ summary: 'Eliminar un intento de prueba' })
    deleteIntento(@Param('id') id: string) {
        return this.aspirantesService.deleteIntento(+id);
    }

    @Patch('intentos/:id/token/invalidate')
    @ApiOperation({ summary: 'Invalidar/Cancelar el token de un intento' })
    invalidateToken(@Param('id') id: string) {
        return this.aspirantesService.invalidateToken(+id);
    }

    @Get('intentos/:id/link-share')
    @ApiOperation({ summary: 'Obtener link y texto predefinido para compartir (WhatsApp/Email)' })
    generateShareLink(@Param('id') id: string) {
        return this.aspirantesService.generateShareLink(+id);
    }

    // ==========================================
    // CONTRATACIÓN
    // ==========================================

    @Post('contratar/:id')
    @ApiOperation({ summary: 'Contratar a un aspirante aprobado (Copia a Empleados)' })
    hireCandidate(@Param('id') id: string, @CurrentUser() admin: any) {
        // CurrentUser returns row/object. We need ID.
        const userId = admin?.id || admin?.sub || 1; // Fallback or handling
        return this.aspirantesService.hireAspirante(+id, userId);
    }

    // ==========================================
    // NUEVOS ENDPOINTS
    // ==========================================

    @Patch('pruebas/:id')
    @ApiOperation({ summary: 'Actualizar una prueba existente' })
    @ApiResponse({ status: 200, description: 'Prueba actualizada exitosamente' })
    updatePrueba(@Param('id') id: string, @Body() dto: any) {
        return this.aspirantesService.updatePrueba(+id, dto);
    }

    @Patch('preguntas/:id')
    @ApiOperation({ summary: 'Actualizar pregunta y/o sus opciones' })
    @ApiResponse({ status: 200, description: 'Pregunta actualizada exitosamente' })
    updatePregunta(@Param('id') id: string, @Body() dto: any) {
        return this.aspirantesService.updatePregunta(+id, dto);
    }

    @Get('pruebas/:id/preguntas')
    @ApiOperation({ summary: 'Listar todas las preguntas de una prueba específica' })
    getPreguntasByPrueba(@Param('id') id: string) {
        return this.aspirantesService.getPreguntasByPrueba(+id);
    }

    @Get('intentos')
    @ApiOperation({ summary: 'Listar todos los intentos con filtros opcionales' })
    @ApiResponse({
        status: 200,
        description: 'Query params: aspirante_id, prueba_id, presentado (true/false), fecha (YYYY-MM-DD)'
    })
    findAllIntentos(@Param() filters: any) {
        return this.aspirantesService.findAllIntentos(filters);
    }

    @Get('candidatos/:id/intentos')
    @ApiOperation({ summary: 'Ver historial de intentos de un aspirante específico' })
    getIntentosByAspirante(@Param('id') id: string) {
        return this.aspirantesService.getIntentosByAspirante(+id);
    }

    @Patch('candidatos/:id/estado')
    @ApiOperation({ summary: 'Cambiar estado manual de un aspirante' })
    @ApiResponse({ status: 200, description: 'Estados: nuevo, en_proceso, aprobado, no_apto, descartado, contratado' })
    updateEstadoAspirante(@Param('id') id: string, @Body() dto: { estado: string; observacion?: string }) {
        return this.aspirantesService.updateEstadoAspirante(+id, dto.estado, dto.observacion);
    }

    @Post('intentos/:id/reenviar')
    @ApiOperation({ summary: 'Reenviar link de prueba (Opcional: regenerar token)' })
    @ApiResponse({ status: 200, description: 'Body opcional: { regenerateToken: true }' })
    resendLink(@Param('id') id: string, @Body() body?: { regenerateToken?: boolean }) {
        return this.aspirantesService.resendLink(+id, body?.regenerateToken);
    }

    @Post('intentos/:id/cancelar')
    @ApiOperation({ summary: 'Cancelar prueba en ejecución (ej: sospecha de fraude)' })
    @ApiResponse({ status: 200, description: 'Marca como cancelado sin borrar respuestas' })
    cancelarIntento(@Param('id') id: string, @Body() dto: { motivo: string }) {
        return this.aspirantesService.cancelarIntento(+id, dto.motivo);
    }
}

