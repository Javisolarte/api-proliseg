import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClientesPotencialesService } from './clientes-potenciales.service';
import { CreateClientePotencialDto, UpdateClientePotencialDto } from './dto/cliente-potencial.dto';

@ApiTags('Clientes Potenciales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('clientes-potenciales')
export class ClientesPotencialesController {
  constructor(private readonly clientesPotencialesService: ClientesPotencialesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo cliente potencial' })
  @ApiResponse({ status: 201, description: 'El cliente potencial ha sido creado exitosamente.' })
  create(@Body() createDto: CreateClientePotencialDto) {
    return this.clientesPotencialesService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener la lista de todos los clientes potenciales' })
  @ApiResponse({ status: 200, description: 'Lista de clientes potenciales obtenida correctamente.' })
  findAll() {
    return this.clientesPotencialesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un cliente potencial por su ID' })
  @ApiResponse({ status: 200, description: 'Cliente potencial encontrado.' })
  @ApiResponse({ status: 404, description: 'Cliente potencial no encontrado.' })
  findOne(@Param('id') id: string) {
    return this.clientesPotencialesService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar la información de un cliente potencial' })
  @ApiResponse({ status: 200, description: 'El cliente potencial ha sido actualizado.' })
  update(@Param('id') id: string, @Body() updateDto: UpdateClientePotencialDto) {
    return this.clientesPotencialesService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un cliente potencial' })
  @ApiResponse({ status: 200, description: 'El cliente potencial ha sido eliminado.' })
  remove(@Param('id') id: string) {
    return this.clientesPotencialesService.remove(id);
  }
}
