import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AspirantesService } from './aspirantes.service';
import { SubmitRespuestaDto } from './dto/submit-respuesta.dto';
import { SaveDatosPreEmpleadoDto } from './dto/save-datos-pre-empleado.dto';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Aspirantes (Public / Token)')
@Controller('public/aspirantes')
@Public()
export class PublicAspirantesController {
    constructor(private readonly aspirantesService: AspirantesService) { }

    @Get('validate/:token')
    @ApiOperation({ summary: 'Validar si un token es válido para iniciar la prueba' })
    @ApiParam({ name: 'token', description: 'Token único del intento' })
    @ApiQuery({ name: 'lat', required: false, type: Number })
    @ApiQuery({ name: 'lng', required: false, type: Number })
    validateToken(
        @Param('token') token: string,
        @Query('lat') lat?: number,
        @Query('lng') lng?: number
    ) {
        return this.aspirantesService.validateToken(token, lat, lng);
    }

    @Post('start/:token')
    @ApiOperation({ summary: 'Iniciar la prueba (Marca hora de inicio)' })
    startTest(@Param('token') token: string) {
        return this.aspirantesService.startTest(token);
    }

    @Post('answer/:token')
    @ApiOperation({ summary: 'Enviar una respuesta (Guardado en tiempo real)' })
    submitAnswer(@Param('token') token: string, @Body() dto: SubmitRespuestaDto) {
        return this.aspirantesService.submitAnswer(token, dto);
    }

    @Post('finish/:token')
    @ApiOperation({ summary: 'Finalizar la prueba y calcular puntaje' })
    finishTest(@Param('token') token: string) {
        return this.aspirantesService.finishTest(token);
    }

    @Get('results/:token')
    @ApiOperation({ summary: 'Obtener resultados y retroalimentación (solo si finalizó)' })
    getResults(@Param('token') token: string) {
        return this.aspirantesService.getResults(token);
    }

    @Post('pre-employment/:token')
    @ApiOperation({ summary: 'Guardar datos pre-empleado (Solo si aprobó)' })
    savePreEmployment(@Param('token') token: string, @Body() dto: SaveDatosPreEmpleadoDto) {
        return this.aspirantesService.savePreEmploymentData(token, dto);
    }

    @Get('status/:token')
    @ApiOperation({ summary: 'Obtener estado público de la prueba (sin respuestas)' })
    @ApiResponse({
        status: 200,
        description: 'Retorna: estado (pendiente/en_progreso/finalizado), tiempo_restante, aprobado, porcentaje'
    })
    getPublicStatus(@Param('token') token: string) {
        return this.aspirantesService.getPublicStatus(token);
    }
}
