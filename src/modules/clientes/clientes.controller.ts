import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from "@nestjs/swagger";
import { ClientesService } from "./clientes.service";
import { CreateClienteDto, UpdateClienteDto } from "./dto/cliente.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";

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
    return this.clientesService.findAll();
  }

  @Get(":id")
  @RequirePermissions("clientes")
  @ApiOperation({ summary: "Obtener cliente por ID" })
  @ApiResponse({ status: 200, description: "Cliente encontrado" })
  @ApiResponse({ status: 404, description: "Cliente no encontrado" })
  async findOne(@Param("id") id: string) {
    return this.clientesService.findOne(Number(id));
  }

  @Post()
  @RequirePermissions("clientes")
  @ApiOperation({ summary: "Crear nuevo cliente" })
  @ApiResponse({ status: 201, description: "Cliente creado exitosamente" })
  @ApiBody({
    description: "Ejemplo de cuerpo para crear un cliente",
    type: CreateClienteDto,
    examples: {
      ejemplo: {
        summary: "Ejemplo básico de creación de cliente",
        value: {
          usuario_id: 1,
          nombre_empresa: "Empresa ABC S.A.S.",
          nit: "900123456-7",
          direccion: "Calle 100 #20-30, Bogotá",
          telefono: "6012345678",
          contacto: "María González",
          activo: true,
        },
      },
    },
  })
  async create(@Body() createClienteDto: CreateClienteDto) {
    return this.clientesService.create(createClienteDto);
  }

  @Put(":id")
  @RequirePermissions("clientes")
  @ApiOperation({ summary: "Actualizar cliente" })
  @ApiResponse({ status: 200, description: "Cliente actualizado correctamente" })
  async update(
    @Param("id") id: string,
    @Body() updateClienteDto: UpdateClienteDto,
  ) {
    return this.clientesService.update(Number(id), updateClienteDto);
  }

  @Delete(":id")
  @RequirePermissions("clientes")
  @ApiOperation({ summary: "Eliminar cliente" })
  @ApiResponse({ status: 200, description: "Cliente eliminado exitosamente" })
  async remove(@Param("id") id: string) {
    return this.clientesService.remove(Number(id));
  }

  @Get(":id/contratos")
  @RequirePermissions("clientes", "contratos")
  @ApiOperation({ summary: "Obtener contratos de un cliente" })
  @ApiResponse({ status: 200, description: "Lista de contratos del cliente" })
  async getContratos(@Param("id") id: string) {
    return this.clientesService.getContratos(Number(id));
  }
}
