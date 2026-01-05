import { Controller, Get, Post, Body, Patch, Param, UseGuards, Query, Delete, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PqrsfService } from './pqrsf.service';
import { CreatePqrsfDto, UpdatePqrsfDto, AddRespuestaDto, AsignarPqrsfDto, CambiarVisibilidadDto } from './dto/pqrsf.dto';

@ApiTags('PQRSF')
@Controller('pqrsf')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class PqrsfController {
    constructor(private readonly pqrsfService: PqrsfService) { }

    @Post()
    @ApiOperation({ summary: 'Crear un nuevo PQRSF' })
    create(@Body() createPqrsfDto: CreatePqrsfDto, @CurrentUser() user: any) {
        return this.pqrsfService.create(createPqrsfDto, user.id);
    }

    @Get()
    @ApiOperation({ summary: 'Listar PQRSF con filtros' })
    @ApiQuery({ name: 'clienteId', required: false })
    @ApiQuery({ name: 'estado', required: false })
    @ApiQuery({ name: 'fechaInicio', required: false })
    @ApiQuery({ name: 'fechaFin', required: false })
    findAll(
        @Query('clienteId') clienteId?: number,
        @Query('estado') estado?: string,
        @Query('fechaInicio') fechaInicio?: string,
        @Query('fechaFin') fechaFin?: string
    ) {
        return this.pqrsfService.findAll({ clienteId, estado, fechaInicio, fechaFin });
    }

    @Get(':id')
    @ApiOperation({ summary: 'Obtener detalle de un PQRSF' })
    findOne(@Param('id') id: number) {
        return this.pqrsfService.findOne(id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Actualizar estado o prioridad de un PQRSF' })
    update(@Param('id') id: number, @Body() updatePqrsfDto: UpdatePqrsfDto, @CurrentUser() user: any) {
        return this.pqrsfService.update(id, updatePqrsfDto, user.id);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Eliminar PQRSF (Soft Delete - Marca como CERRADO)' })
    remove(@Param('id') id: number, @CurrentUser() user: any) {
        return this.pqrsfService.remove(id, user.id);
    }

    @Patch(':id/cerrar')
    @ApiOperation({ summary: 'Cerrar PQRSF por el cliente' })
    cerrar(@Param('id') id: number, @CurrentUser() user: any) {
        return this.pqrsfService.cerrar(id, user.id);
    }

    @Patch(':id/reabrir')
    @ApiOperation({ summary: 'Reabrir PQRSF' })
    reabrir(@Param('id') id: number, @CurrentUser() user: any) {
        return this.pqrsfService.reabrir(id, user.id);
    }

    @Post(':id/asignar')
    @ApiOperation({ summary: 'Asignar responsable interno' })
    asignar(@Param('id') id: number, @Body() dto: AsignarPqrsfDto, @CurrentUser() user: any) {
        return this.pqrsfService.asignar(id, dto, user.id);
    }

    @Patch(':id/reasignar')
    @ApiOperation({ summary: 'Cambiar responsable (reasignar)' })
    reasignar(@Param('id') id: number, @Body() dto: AsignarPqrsfDto, @CurrentUser() user: any) {
        return this.pqrsfService.asignar(id, dto, user.id); // Reutilizamos lógica de asignar
    }

    // --- Sub-recursos (Respuestas y Adjuntos) ---

    @Get(':id/respuestas')
    @ApiOperation({ summary: 'Listar respuestas de un PQRSF' })
    getRespuestas(@Param('id') id: number) {
        return this.pqrsfService.getRespuestas(id);
    }

    @Post(':id/respuestas')
    @ApiOperation({ summary: 'Agregar respuesta a un PQRSF' })
    addRespuesta(@Param('id') id: number, @Body() addRespuestaDto: AddRespuestaDto, @CurrentUser() user: any) {
        return this.pqrsfService.addRespuesta(id, addRespuestaDto, user.id);
    }

    @Patch('respuestas/:id/visibilidad')
    @ApiOperation({ summary: 'Cambiar visibilidad de una respuesta' })
    changeVisibilidad(@Param('id') id: number, @Body() dto: CambiarVisibilidadDto) {
        return this.pqrsfService.changeRespuestaVisibility(id, dto.visible_para_cliente);
    }

    @Get(':id/adjuntos')
    @ApiOperation({ summary: 'Listar adjuntos de un PQRSF' })
    getAdjuntos(@Param('id') id: number) {
        return this.pqrsfService.getAdjuntos(id);
    }

    @Post(':id/adjuntos')
    @ApiOperation({ summary: 'Agregar archivo adjunto a un PQRSF' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                },
                tipo: {
                    type: 'string',
                    example: 'evidencia',
                    description: 'Tipo de archivo (opcional)'
                }
            },
        },
    })
    @UseInterceptors(FileInterceptor('file'))
    addAdjunto(
        @Param('id') id: number,
        @UploadedFile() file: Express.Multer.File,
        @Body('tipo') tipo: string,
        @CurrentUser() user: any
    ) {
        if (!file) throw new BadRequestException('Archivo requerido');
        return this.pqrsfService.addAdjunto(id, user.id, file, tipo);
    }

    @Delete('adjuntos/:id')
    @ApiOperation({ summary: 'Eliminar adjunto' })
    deleteAdjunto(@Param('id') id: number) {
        return this.pqrsfService.deleteAdjunto(id);
    }
}
