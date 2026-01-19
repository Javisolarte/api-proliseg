import { Controller, Get, Post, Body, Put, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CalendarioService } from './calendario.service';
import { CreateEventoDto, UpdateEventoDto, CreateRecordatorioDto } from './dto/calendario.dto';

@ApiTags('Calendario')
@Controller('calendario')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CalendarioController {
    constructor(private readonly calendarioService: CalendarioService) { }

    // --- EVENTOS ---

    @Get('eventos')
    @RequirePermissions('calendario')
    @ApiOperation({ summary: 'Listar eventos del usuario' })
    @ApiQuery({ name: 'usuarioId', required: false })
    async fetchEventos(@Query('usuarioId') usuarioId?: number) {
        return this.calendarioService.findEventos(usuarioId);
    }

    @Get('eventos/:id')
    @RequirePermissions('calendario')
    @ApiOperation({ summary: 'Obtener detalle de un evento' })
    async findOneEvent(@Param('id') id: number) {
        return this.calendarioService.findOneEvento(id);
    }

    @Post('eventos')
    @RequirePermissions('calendario')
    @ApiOperation({ summary: 'Crear nuevo evento' })
    async createEvent(@Body() dto: CreateEventoDto) {
        return this.calendarioService.createEvento(dto);
    }

    @Put('eventos/:id')
    @RequirePermissions('calendario')
    @ApiOperation({ summary: 'Actualizar evento' })
    async updateEvent(@Param('id') id: number, @Body() dto: UpdateEventoDto) {
        return this.calendarioService.updateEvento(id, dto);
    }

    @Delete('eventos/:id')
    @RequirePermissions('calendario')
    @ApiOperation({ summary: 'Eliminar evento' })
    async removeEvent(@Param('id') id: number) {
        return this.calendarioService.removeEvento(id);
    }

    // --- RECORDATORIOS ---

    @Post('recordatorios')
    @RequirePermissions('calendario')
    @ApiOperation({ summary: 'Programar recordatorio para un evento' })
    async createReminder(@Body() dto: CreateRecordatorioDto) {
        return this.calendarioService.createRecordatorio(dto);
    }

    @Delete('recordatorios/:id')
    @RequirePermissions('calendario')
    @ApiOperation({ summary: 'Eliminar recordatorio' })
    async removeReminder(@Param('id') id: number) {
        return this.calendarioService.removeRecordatorio(id);
    }
}
