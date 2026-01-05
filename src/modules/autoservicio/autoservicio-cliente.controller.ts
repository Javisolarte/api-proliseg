import { Controller, Get, Post, UseGuards, Param, Query, Body, UseInterceptors, UploadedFile, ParseFilePipe, MaxFileSizeValidator } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AutoservicioService } from './autoservicio.service';
import { CreatePqrsfDto } from '../pqrsf/dto/pqrsf.dto';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('Autoservicio - Cliente')
@Controller('mi-contrato-cliente')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class AutoservicioClienteController {
    constructor(private readonly autoservicioService: AutoservicioService) { }

    @Get()
    @ApiOperation({ summary: 'Ver contratos comerciales del cliente (Activos e Inactivos)' })
    async getMiContratoCliente(@CurrentUser() user: any) {
        return this.autoservicioService.getMiContratoCliente(user.id);
    }

    @Get(':contratoId/detalle')
    @ApiOperation({ summary: 'Ver detalle de un contrato (Puestos y Vigilantes)' })
    async getDetalleContrato(@CurrentUser() user: any, @Param('contratoId') contratoId: number) {
        return this.autoservicioService.getDetalleContratoCliente(user.id, contratoId);
    }

    @Get(':contratoId/horarios')
    @ApiOperation({ summary: 'Ver horarios de personal en un contrato' })
    @ApiQuery({ name: 'fechaInicio', required: false })
    @ApiQuery({ name: 'fechaFin', required: false })
    async getHorariosContrato(
        @CurrentUser() user: any,
        @Param('contratoId') contratoId: number,
        @Query('fechaInicio') fechaInicio?: string,
        @Query('fechaFin') fechaFin?: string
    ) {
        return this.autoservicioService.getHorariosContratoCliente(user.id, contratoId, fechaInicio, fechaFin);
    }

    @Get('minutas')
    @ApiOperation({ summary: 'Ver minutas visibles para cliente' })
    async getMinutasCliente(@CurrentUser() user: any) {
        return this.autoservicioService.getMinutasCliente(user.id);
    }

    @Get('novedades')
    @ApiOperation({ summary: 'Ver novedades de los puestos del cliente' })
    async getNovedadesCliente(@CurrentUser() user: any) {
        return this.autoservicioService.getNovedadesCliente(user.id);
    }

    @Get('empleados')
    @ApiOperation({ summary: 'Ver empleados asignados a mis puestos' })
    async getEmpleadosAsignados(@CurrentUser() user: any) {
        return this.autoservicioService.getEmpleadosAsignadosCliente(user.id);
    }

    @Get('pqrs')
    @ApiOperation({ summary: 'Ver mis PQRS (Peticiones, Quejas, Reclamos)' })
    @ApiQuery({ name: 'estado', required: false })
    @ApiQuery({ name: 'fechaInicio', required: false })
    @ApiQuery({ name: 'fechaFin', required: false })
    async getMisPqrs(
        @CurrentUser() user: any,
        @Query('estado') estado?: string,
        @Query('fechaInicio') fechaInicio?: string,
        @Query('fechaFin') fechaFin?: string
    ) {
        return this.autoservicioService.getPqrsCliente(user.id, { estado, fechaInicio, fechaFin });
    }

    @Get('pqrs/:id')
    @ApiOperation({ summary: 'Ver detalle de un PQRS' })
    async getPqrsDetalle(@CurrentUser() user: any, @Param('id') id: number) {
        return this.autoservicioService.getPqrsDetalleCliente(user.id, id);
    }

    @Post('pqrs')
    @ApiOperation({ summary: 'Crear un nuevo PQRS' })
    async createPqrs(@CurrentUser() user: any, @Body() createPqrsDto: CreatePqrsfDto) {
        // Remove validations that might be for internal users if any, strict to what client sends
        // Actually reuse CreatePqrsfDto nicely
        // Note: client_id in DTO is redundant as we know it from user, but DTO might require it. 
        // We will overload it in service or ignore it.
        // Actually CreatePqrsfDto has client_id as number. The client might not know their ID? 
        // User IS the client user, but they belong to a Client Entry.
        // We handle that in service.
        return this.autoservicioService.createPqrsCliente(user.id, createPqrsDto);
    }

    @Post('pqrs/:id/adjuntos')
    @ApiOperation({ summary: 'Agregar evidencia (foto/pdf) a un PQRS' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                },
            },
        },
    })
    @UseInterceptors(FileInterceptor('file'))
    async addAdjuntoPqrs(
        @CurrentUser() user: any,
        @Param('id') id: number,
        @UploadedFile(
            new ParseFilePipe({
                validators: [
                    new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 5 }), // 5MB
                ],
                fileIsRequired: true
            }),
        ) file: any,
    ) {
        return this.autoservicioService.addAdjuntoCliente(user.id, id, file);
    }
}
