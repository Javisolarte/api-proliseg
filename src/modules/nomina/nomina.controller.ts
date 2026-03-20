import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
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

    // ══════════════════════════════════════════════════════════
    // PERIODOS
    // ══════════════════════════════════════════════════════════

    @Post('periodos')
    @ApiOperation({ summary: 'Crear periodo de nómina' })
    async createPeriod(@Body() dto: CreatePeriodoDto, @CurrentUser() user: any) {
        return this.nominaService.createPeriod(dto, user.id);
    }

    @Get('periodos')
    @ApiOperation({ summary: 'Listar todos los periodos de nómina' })
    async getAllPeriodos() {
        return this.nominaService.getAllPeriodos();
    }

    @Get('periodo/:id')
    @ApiOperation({ summary: 'Listar nómina de un periodo' })
    async getByPeriodo(@Param('id', ParseIntPipe) id: number) {
        return this.nominaService.getNominaByPeriodo(id);
    }

    @Get('periodo/:id/detalle')
    @ApiOperation({ summary: 'Detalle completo de nómina por periodo' })
    async getPeriodoDetalle(@Param('id', ParseIntPipe) id: number) {
        return this.nominaService.getPeriodoDetalle(id);
    }

    @Post('generar')
    @ApiOperation({ summary: 'Generar nómina para un año y mes específico' })
    async generar(
        @Body('anio') anio: number,
        @Body('mes') mes: number,
        @CurrentUser() user: any,
    ) {
        return this.nominaService.generarNomina(anio, mes, user.id);
    }

    @Post('cerrar/:id')
    @ApiOperation({ summary: 'Cerrar periodo de nómina' })
    async closePeriod(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
        return this.nominaService.closePeriod(id, user.id);
    }

    @Post('recalcular/:id')
    @ApiOperation({ summary: 'Recalcular periodo de nómina abierto' })
    async recalculatePeriod(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
        return this.nominaService.recalculatePeriod(id, user.id);
    }

    // ══════════════════════════════════════════════════════════
    // EMPLEADO
    // ══════════════════════════════════════════════════════════

    @Post('calcular-empleado')
    @ApiOperation({ summary: 'Simular nómina para un empleado (sin guardar)' })
    async calcularEmpleado(
        @Body('empleadoId') empleadoId: number,
        @Body('anio') anio: number,
        @Body('mes') mes: number,
    ) {
        return this.nominaService.calcularNominaEmpleado(empleadoId, anio, mes);
    }

    @Get('empleado/:id')
    @ApiOperation({ summary: 'Historial de nómina por empleado' })
    async getEmployeeHistory(@Param('id', ParseIntPipe) id: number) {
        return this.nominaService.getEmployeeHistory(id);
    }

    @Get('empleado/:id/periodo/:periodoId/desprendible')
    @ApiOperation({ summary: 'Obtener desprendible individual' })
    async getAdminDesprendible(
        @Param('id', ParseIntPipe) id: number,
        @Param('periodoId', ParseIntPipe) periodoId: number
    ) {
        return this.nominaService.getAdminDesprendible(id, periodoId);
    }

    @Get('resumen/:year/:month')
    @ApiOperation({ summary: 'Resumen estadístico de nómina por fecha' })
    async getSummary(
        @Param('year', ParseIntPipe) year: number,
        @Param('month', ParseIntPipe) month: number
    ) {
        return this.nominaService.getSummary(year, month);
    }

    // ══════════════════════════════════════════════════════════
    // PARÁMETROS
    // ══════════════════════════════════════════════════════════

    @Get('parametros')
    @ApiOperation({ summary: 'Listar todos los parámetros' })
    async listarParametros() {
        return this.nominaService.listarParametros();
    }

    @Get('parametros/:anio')
    @ApiOperation({ summary: 'Listar parámetros por año' })
    async listarParametrosPorAnio(@Param('anio', ParseIntPipe) anio: number) {
        return this.nominaService.listarParametros(anio);
    }

    @Post('parametros')
    @ApiOperation({ summary: 'Crear parámetro' })
    async crearParametro(@Body() dto: any) {
        return this.nominaService.crearParametro(dto);
    }

    @Put('parametros/:id')
    @ApiOperation({ summary: 'Actualizar parámetro' })
    async actualizarParametro(@Param('id', ParseIntPipe) id: number, @Body() dto: any) {
        return this.nominaService.actualizarParametro(id, dto);
    }

    @Delete('parametros/:id')
    @ApiOperation({ summary: 'Eliminar parámetro' })
    async eliminarParametro(@Param('id', ParseIntPipe) id: number) {
        return this.nominaService.eliminarParametro(id);
    }

    @Post('parametros/clonar/:anioOrigen')
    @ApiOperation({ summary: 'Clonar parámetros de un año a otro' })
    async clonarParametros(@Param('anioOrigen', ParseIntPipe) anioOrigen: number) {
        return this.nominaService.clonarParametros(anioOrigen);
    }

    // ══════════════════════════════════════════════════════════
    // DEDUCCIONES
    // ══════════════════════════════════════════════════════════

    @Get('deducciones')
    @ApiOperation({ summary: 'Listar todas las deducciones' })
    async listarDeducciones() {
        return this.nominaService.listarDeducciones();
    }

    @Get('deducciones/activas')
    @ApiOperation({ summary: 'Listar deducciones activas' })
    async listarDeduccionesActivas() {
        return this.nominaService.listarDeduccionesActivas();
    }

    @Post('deducciones')
    @ApiOperation({ summary: 'Crear deducción' })
    async crearDeduccion(@Body() dto: any) {
        return this.nominaService.crearDeduccion(dto);
    }

    @Put('deducciones/:id')
    @ApiOperation({ summary: 'Actualizar deducción' })
    async actualizarDeduccion(@Param('id', ParseIntPipe) id: number, @Body() dto: any) {
        return this.nominaService.actualizarDeduccion(id, dto);
    }

    @Delete('deducciones/:id')
    @ApiOperation({ summary: 'Eliminar deducción' })
    async eliminarDeduccion(@Param('id', ParseIntPipe) id: number) {
        return this.nominaService.eliminarDeduccion(id);
    }

    // ══════════════════════════════════════════════════════════
    // NOVEDADES
    // ══════════════════════════════════════════════════════════

    @Get('novedades/periodo/:periodoId')
    @ApiOperation({ summary: 'Listar novedades de un periodo' })
    async listarNovedades(@Param('periodoId', ParseIntPipe) periodoId: number) {
        return this.nominaService.listarNovedades(periodoId);
    }

    @Post('novedades')
    @ApiOperation({ summary: 'Registrar novedad' })
    async registrarNovedad(@Body() dto: any) {
        return this.nominaService.registrarNovedad(dto);
    }

    @Delete('novedades/:id')
    @ApiOperation({ summary: 'Eliminar novedad' })
    async eliminarNovedad(@Param('id', ParseIntPipe) id: number) {
        return this.nominaService.eliminarNovedad(id);
    }
}
