import { Controller, Get, Param, ParseIntPipe, Post, Body, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AutoservicioService } from './autoservicio.service';
import { CreateMinutaDto } from '../minutas/dto/minuta.dto';

@ApiTags('Autoservicio - Empleado')
@Controller('mi-nomina')
// Note: We might want multiple prefixes or route everything under 'autoservicio/empleado', 
// but user requested '/api/mi-nomina', '/api/mi-contrato' etc.
// NestJS allows multiple controllers or custom routes.
// To stick to user request strictly: I will separate controllers or use separate route prefixes on methods?
// NestJS controller decorator takes prefix.
// Setup:
// Controller 1: /mi-nomina
// Controller 2: /mi-contrato ...
// Actually, let's group them by feature in the class but with distinct paths if possible, OR just multiple controllers. 
// Simpler: One controller 'AutoservicioEmpleadoController' handling multiple root paths via standard routing is tricky without specific mapping.
// Best approach: Use '/api' global prefix (implied). 
// Accessing '/mi-nomina' requires Controller('mi-nomina').
// I will create a single controller but mapped to 'api/...' (handled by global prefix)
// WAIT: The user asked for `GET /api/mi-nomina`, `GET /api/mi-contrato`.
// I can make a controller with NO prefix (Empty) and then specifc routes? No, better to have a common prefix or multiple controllers.
// Let's use `AutoservicioEmpleadoController` mapped to nothing and alias routes?
// Actually, creating separate controllers for each "resource" (MiNominaController, MiContratoController) is cleaner if we want strict resource separation, 
// BUT fitting them all in `AutoservicioEmpleadoController` is more cohesive for this module.
// Route: @Controller('') -> @Get('mi-nomina')
// Let's try that.

@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class AutoservicioEmpleadoController {
    constructor(private readonly autoservicioService: AutoservicioService) { }

    // --- MI NOMINA ---
    @Get('mi-nomina')
    @ApiOperation({ summary: 'Obtener periodos de nómina del empleado autenticado' })
    async getMiNomina(@CurrentUser() user: any) {
        return this.autoservicioService.getMiNomina(user.id);
    }

    @Get('mi-nomina/historial')
    @ApiOperation({ summary: 'Historial de nóminas' })
    async getMiNominaHistorial(@CurrentUser() user: any) {
        return this.autoservicioService.getMiNominaHistorial(user.id);
    }

    @Get('mi-nomina/:id/desprendible')
    @ApiOperation({ summary: 'Descargar desprendible PDF' })
    async getMiDesprendible(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
        return this.autoservicioService.getMiDesprendible(id, user.id);
    }

    // --- MI CONTRATO ---
    @Get('mi-contrato')
    @ApiOperation({ summary: 'Ver contrato vigente' })
    async getMiContrato(@CurrentUser() user: any) {
        return this.autoservicioService.getMiContrato(user.id);
    }

    @Get('mi-contrato/historial')
    @ApiOperation({ summary: 'Historial de contratos' })
    async getMiContratoHistorial(@CurrentUser() user: any) {
        return this.autoservicioService.getMiContratoHistorial(user.id);
    }

    // --- OPERATIVO ---
    @Get('mi-perfil')
    @ApiOperation({ summary: 'Ver perfil del empleado (sin métricas sensibles)' })
    async getMiPerfil(@CurrentUser() user: any) {
        return this.autoservicioService.getMiPerfil(user.id);
    }

    @Get('mi-puesto')
    @ApiOperation({ summary: 'Ver puesto asignado actual' })
    async getMiPuesto(@CurrentUser() user: any) {
        return this.autoservicioService.getMiPuesto(user.id);
    }

    @Get('mis-turnos')
    @ApiOperation({ summary: 'Listar turnos del empleado' })
    async getMisTurnos(@CurrentUser() user: any) {
        return this.autoservicioService.getMisTurnos(user.id);
    }

    @Get('mis-minutas')
    @ApiOperation({ summary: 'Ver minutas creadas por el empleado' })
    async getMisMinutas(@CurrentUser() user: any) {
        return this.autoservicioService.getMisMinutas(user.id);
    }

    @Get('mis-minutas/puesto')
    @ApiOperation({ summary: 'Ver historial de minutas del puesto actual' })
    async getHistorialPuesto(@CurrentUser() user: any) {
        return this.autoservicioService.getMinutasPuesto(user.id);
    }

    @Post('mis-minutas')
    @ApiOperation({ summary: 'Crear minuta (solo si tiene turno activo)' })
    async createMinuta(@CurrentUser() user: any, @Body() minutaDto: CreateMinutaDto) {
        return this.autoservicioService.createMinuta(user.id, minutaDto);
    }
}
