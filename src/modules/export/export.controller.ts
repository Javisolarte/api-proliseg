import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ExportService } from './export.service';
import { ExportQueryDto } from './dto/export-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { SupabaseService } from '../supabase/supabase.service';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

@ApiTags('Export')
@Controller('api/export')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ExportController {
    constructor(
        private readonly exportService: ExportService,
        private readonly supabaseService: SupabaseService,
    ) { }

    @Get('cotizaciones')
    @RequirePermissions('exportar')
    @ApiOperation({ summary: 'Exportar cotizaciones' })
    @ApiQuery({ name: 'formato', enum: ['pdf', 'excel', 'csv'] })
    async exportCotizaciones(@Query() query: ExportQueryDto, @Res() res: Response) {
        const supabase = this.supabaseService.getClient();

        let queryBuilder = supabase.from('cotizaciones').select('*');

        if (query.desde) queryBuilder = queryBuilder.gte('created_at', query.desde);
        if (query.hasta) queryBuilder = queryBuilder.lte('created_at', query.hasta);
        if (query.cliente_id) queryBuilder = queryBuilder.eq('cliente_id', query.cliente_id);
        if (query.estado) queryBuilder = queryBuilder.eq('estado', query.estado);

        const { data } = await queryBuilder;

        const headers = ['ID', 'Cliente ID', 'Estado', 'Subtotal', 'Total', 'Fecha Creación'];
        const filename = `cotizaciones_${new Date().toISOString().split('T')[0]}`;

        if (query.formato === 'excel') {
            return this.exportService.exportToExcel(data || [], headers, filename, res);
        } else if (query.formato === 'csv') {
            return this.exportService.exportToCSV(data || [], headers, filename, res);
        } else {
            return this.exportService.exportToPDF(data || [], headers, filename, res);
        }
    }

    @Get('visitas')
    @RequirePermissions('exportar')
    @ApiOperation({ summary: 'Exportar visitas' })
    async exportVisitas(@Query() query: ExportQueryDto, @Res() res: Response) {
        const supabase = this.supabaseService.getClient();

        let queryBuilder = supabase.from('visitas_registro').select('*');

        if (query.desde) queryBuilder = queryBuilder.gte('created_at', query.desde);
        if (query.hasta) queryBuilder = queryBuilder.lte('created_at', query.hasta);

        const { data } = await queryBuilder;

        const headers = ['ID', 'Visitante', 'Documento', 'Fecha Entrada', 'Fecha Salida', 'Estado'];
        const filename = `visitas_${new Date().toISOString().split('T')[0]}`;

        if (query.formato === 'excel') {
            return this.exportService.exportToExcel(data || [], headers, filename, res);
        } else if (query.formato === 'csv') {
            return this.exportService.exportToCSV(data || [], headers, filename, res);
        } else {
            return this.exportService.exportToPDF(data || [], headers, filename, res);
        }
    }

    @Get('rondas')
    @RequirePermissions('exportar')
    @ApiOperation({ summary: 'Exportar rondas' })
    async exportRondas(@Query() query: ExportQueryDto, @Res() res: Response) {
        const supabase = this.supabaseService.getClient();

        let queryBuilder = supabase.from('rondas_ejecucion').select('*');

        if (query.desde) queryBuilder = queryBuilder.gte('created_at', query.desde);
        if (query.hasta) queryBuilder = queryBuilder.lte('created_at', query.hasta);
        if (query.puesto_id) queryBuilder = queryBuilder.eq('puesto_id', query.puesto_id);

        const { data } = await queryBuilder;

        const headers = ['ID', 'Puesto ID', 'Empleado ID', 'Fecha Inicio', 'Fecha Fin', 'Estado'];
        const filename = `rondas_${new Date().toISOString().split('T')[0]}`;

        if (query.formato === 'excel') {
            return this.exportService.exportToExcel(data || [], headers, filename, res);
        } else if (query.formato === 'csv') {
            return this.exportService.exportToCSV(data || [], headers, filename, res);
        } else {
            return this.exportService.exportToPDF(data || [], headers, filename, res);
        }
    }

    @Get('inventario')
    @RequirePermissions('exportar')
    @ApiOperation({ summary: 'Exportar inventario' })
    async exportInventario(@Query() query: ExportQueryDto, @Res() res: Response) {
        const supabase = this.supabaseService.getClient();

        const { data } = await supabase.from('inventario').select('*');

        const headers = ['ID', 'Nombre', 'Categoría', 'Cantidad', 'Valor Unitario', 'Estado'];
        const filename = `inventario_${new Date().toISOString().split('T')[0]}`;

        if (query.formato === 'excel') {
            return this.exportService.exportToExcel(data || [], headers, filename, res);
        } else if (query.formato === 'csv') {
            return this.exportService.exportToCSV(data || [], headers, filename, res);
        } else {
            return this.exportService.exportToPDF(data || [], headers, filename, res);
        }
    }

    @Get('residentes')
    @RequirePermissions('exportar')
    @ApiOperation({ summary: 'Exportar residentes' })
    async exportResidentes(@Query() query: ExportQueryDto, @Res() res: Response) {
        const supabase = this.supabaseService.getClient();

        const { data } = await supabase.from('residentes').select('*');

        const headers = ['ID', 'Nombre Completo', 'Documento', 'Unidad', 'Teléfono', 'Email'];
        const filename = `residentes_${new Date().toISOString().split('T')[0]}`;

        if (query.formato === 'excel') {
            return this.exportService.exportToExcel(data || [], headers, filename, res);
        } else if (query.formato === 'csv') {
            return this.exportService.exportToCSV(data || [], headers, filename, res);
        } else {
            return this.exportService.exportToPDF(data || [], headers, filename, res);
        }
    }
}
