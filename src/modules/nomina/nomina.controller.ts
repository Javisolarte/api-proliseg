import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NominaService } from './nomina.service';
import { CreatePeriodoDto } from './dto/create-periodo.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Nomina - Contabilidad')
@Controller('nomina')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('nomina')
@ApiBearerAuth('JWT-auth')
export class NominaController {
    constructor(private readonly nominaService: NominaService) { }

    @Post('periodos')
    @ApiOperation({ summary: 'Crear periodo de nomina' })
    async createPeriod(@Body() dto: CreatePeriodoDto, @CurrentUser() user: any) {
        return this.nominaService.createPeriod(dto, user.id);
    }

    @Post('generar')
    @ApiOperation({ summary: 'Generar nomina para un año y mes específico' })
    async generar(
        @Body('anio') anio: number,
        @Body('mes') mes: number,
        @CurrentUser() user: any,
    ) {
        return this.nominaService.generarNomina(anio, mes, user.id);
    }

    @Get('periodo/:id')
    @ApiOperation({ summary: 'Listar nomina de un periodo' })
    async getByPeriodo(@Param('id', ParseIntPipe) id: number) {
        return this.nominaService.getNominaByPeriodo(id);
    }

    @Get('periodo/:id/detalle')
    @ApiOperation({ summary: 'Detalle completo de nomina por periodo (Admin)' })
    async getPeriodoDetalle(@Param('id', ParseIntPipe) id: number) {
        return this.nominaService.getPeriodoDetalle(id);
    }

    @Get('empleado/:id/periodo/:periodoId/desprendible')
    @ApiOperation({ summary: 'Descargar desprendible individual (Admin)' })
    async getAdminDesprendible(
        @Param('id', ParseIntPipe) id: number,
        @Param('periodoId', ParseIntPipe) periodoId: number
    ) {
        return this.nominaService.getAdminDesprendible(id, periodoId);
    }




    @Post('calcular-empleado')
    @ApiOperation({ summary: 'Simular nomina para un empleado (sin guardar)' })
    async calcularEmpleado(
        @Body('empleadoId') empleadoId: number,
        @Body('anio') anio: number,
        @Body('mes') mes: number,
    ) {
        return this.nominaService.calcularNominaEmpleado(empleadoId, anio, mes);
    }

    @Get('periodos')
    @ApiOperation({ summary: 'Listar todos los periodos de nomina' })
    async getAllPeriodos() {
        return this.nominaService.getAllPeriodos();
    }

    @Get('empleado/:id')
    @ApiOperation({ summary: 'Historial de nomina por empleado' })
    async getEmployeeHistory(@Param('id', ParseIntPipe) id: number) {
        return this.nominaService.getEmployeeHistory(id);
    }

    @Get('resumen/:year/:month')
    @ApiOperation({ summary: 'Resumen estadístico de nomina por fecha' })
    async getSummary(
        @Param('year', ParseIntPipe) year: number,
        @Param('month', ParseIntPipe) month: number
    ) {
        return this.nominaService.getSummary(year, month);
    }

    @Post('cerrar/:id')
    @ApiOperation({ summary: 'Cerrar periodo de nomina' })
    async closePeriod(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
        return this.nominaService.closePeriod(id, user.id);
    }

    @Post('recalcular/:id')
    @ApiOperation({ summary: 'Recalcular periodo de nomina abierto' })
    async recalculatePeriod(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
        return this.nominaService.recalculatePeriod(id, user.id);
    }
}
