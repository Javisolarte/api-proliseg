import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from "@nestjs/common"
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger"
import  { ClientesService } from "./clientes.service"
import type { CreateClienteDto, UpdateClienteDto } from "./dto/cliente.dto"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { PermissionsGuard } from "../auth/guards/permissions.guard"
import { RequirePermissions } from "../auth/decorators/permissions.decorator"

@ApiTags("Clientes")
@Controller("clientes")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Get()
  @RequirePermissions("clientes")
  @ApiOperation({ summary: "Listar todos los clientes" })
  @ApiResponse({ status: 200, description: "Lista de clientes" })
  async findAll() {
    return this.clientesService.findAll()
  }

  @Get(':id')
  @RequirePermissions('clientes')
  @ApiOperation({ summary: 'Obtener cliente por ID' })
  @ApiResponse({ status: 200, description: 'Cliente encontrado' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  async findOne(@Param('id') id: string) {
  return this.clientesService.findOne(Number(id));
}

  @Post()
  @RequirePermissions('clientes')
  @ApiOperation({ summary: 'Crear nuevo cliente' })
  @ApiResponse({ status: 201, description: 'Cliente creado exitosamente' })
  async create(@Body() createClienteDto: CreateClienteDto) {
    return this.clientesService.create(createClienteDto);
  }

@Put(':id')
@RequirePermissions('clientes')
@ApiOperation({ summary: 'Actualizar cliente' })
async update(@Param('id') id: string, @Body() updateClienteDto: UpdateClienteDto) {
  return this.clientesService.update(Number(id), updateClienteDto);
}

  @Delete(':id')
  @RequirePermissions('clientes')
  @ApiOperation({ summary: 'Eliminar cliente' })
  @ApiResponse({ status: 200, description: 'Cliente eliminado exitosamente' })
 async remove(@Param('id') id: string) {
  return this.clientesService.remove(Number(id));
}


  @Get(':id/contratos')
  @RequirePermissions('clientes', 'contratos')
  @ApiOperation({ summary: 'Obtener contratos de un cliente' })
  @ApiResponse({ status: 200, description: 'Lista de contratos' })
  async getContratos(@Param('id') id: string) {
  return this.clientesService.getContratos(Number(id));
}
}
