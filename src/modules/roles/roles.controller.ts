import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from "@nestjs/common"
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger"
import type { RolesService } from "./roles.service"
import type { CreateRolDto, UpdateRolDto, AsignarModuloRolDto } from "./dto/rol.dto"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { PermissionsGuard } from "../auth/guards/permissions.guard"
import { RequirePermissions } from "../auth/decorators/permissions.decorator"
import { Roles } from "../auth/decorators/roles.decorator"

@ApiTags("Roles")
@Controller("roles")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions("roles")
  @ApiOperation({ summary: "Listar todos los roles" })
  @ApiResponse({ status: 200, description: "Lista de roles" })
  async findAll() {
    return this.rolesService.findAll()
  }

  @Get(':id')
  @RequirePermissions('roles')
  @ApiOperation({ summary: 'Obtener rol por ID' })
  @ApiResponse({ status: 200, description: 'Rol encontrado' })
 async findOne(@Param('id') id: string) {
  return this.rolesService.findOne(Number(id));
}

  @Post()
  @RequirePermissions('roles')
  @Roles('superusuario')
  @ApiOperation({ summary: 'Crear nuevo rol' })
  @ApiResponse({ status: 201, description: 'Rol creado exitosamente' })
  async create(@Body() createRolDto: CreateRolDto) {
    return this.rolesService.create(createRolDto);
  }

  @Put(":id")
  @RequirePermissions("roles")
  @Roles("superusuario")
  @ApiOperation({ summary: "Actualizar rol" })
  @ApiResponse({ status: 200, description: "Rol actualizado exitosamente" })
  async update(@Param('id') id: string, @Body() updateRolDto: UpdateRolDto) {
  return this.rolesService.update(Number(id), updateRolDto);
}


  @Delete(':id')
  @RequirePermissions('roles')
  @Roles('superusuario')
  @ApiOperation({ summary: 'Desactivar rol' })
  @ApiResponse({ status: 200, description: 'Rol desactivado exitosamente' })
  async remove(@Param('id') id: string) {
  return this.rolesService.remove(Number(id));
}

  @Get(':id/modulos')
  @RequirePermissions('roles')
  @ApiOperation({ summary: 'Obtener módulos de un rol' })
  @ApiResponse({ status: 200, description: 'Módulos del rol' })
 async getModulos(@Param('id') id: string) {
  return this.rolesService.getModulos(Number(id));
}

  @Post(":id/modulos")
  @RequirePermissions("roles")
  @Roles("superusuario")
  @ApiOperation({ summary: "Asignar módulo a rol" })
  @ApiResponse({ status: 200, description: "Módulo asignado exitosamente" })
  async asignarModulo(@Param('id') id: string, @Body() asignarModuloRolDto: AsignarModuloRolDto) {
  return this.rolesService.asignarModulo(Number(id), asignarModuloRolDto);
}

  @Delete(":id/modulos/:moduloId")
  @RequirePermissions("roles")
  @Roles("superusuario")
  @ApiOperation({ summary: "Remover módulo de rol" })
  @ApiResponse({ status: 200, description: "Módulo removido exitosamente" })
async removerModulo(@Param('id') id: string, @Param('moduloId') moduloId: string) {
  return this.rolesService.removerModulo(Number(id), Number(moduloId));
}
}
