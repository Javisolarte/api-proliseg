import { Controller, Get, Put, Delete, Body, Param, UseGuards, Post } from "@nestjs/common"
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger"
import  { UsuariosService } from "./usuarios.service"
import type { UpdateUsuarioDto, AsignarModuloDto } from "./dto/usuario.dto"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { PermissionsGuard } from "../auth/guards/permissions.guard"
import { RequirePermissions } from "../auth/decorators/permissions.decorator"
import { Roles } from "../auth/decorators/roles.decorator"

@ApiTags("Usuarios")
@Controller("usuarios")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  @RequirePermissions("usuarios")
  @ApiOperation({ summary: "Listar todos los usuarios" })
  @ApiResponse({ status: 200, description: "Lista de usuarios" })
  async findAll() {
    return this.usuariosService.findAll()
  }

  @Get(':id')
  @RequirePermissions('usuarios')
  @ApiOperation({ summary: 'Obtener usuario por ID' })
  @ApiResponse({ status: 200, description: 'Usuario encontrado' })
  async findOne(@Param('id') id: number) {
    return this.usuariosService.findOne(id);
  }

  @Put(":id")
  @RequirePermissions("usuarios")
  @ApiOperation({ summary: "Actualizar usuario" })
  @ApiResponse({ status: 200, description: "Usuario actualizado exitosamente" })
  async update(@Param('id') id: number, @Body() updateUsuarioDto: UpdateUsuarioDto) {
    return this.usuariosService.update(id, updateUsuarioDto)
  }

  @Delete(':id')
  @RequirePermissions('usuarios')
  @Roles('superusuario', 'administrador')
  @ApiOperation({ summary: 'Desactivar usuario' })
  @ApiResponse({ status: 200, description: 'Usuario desactivado exitosamente' })
  async remove(@Param('id') id: number) {
    return this.usuariosService.remove(id);
  }

  @Get(':id/permisos')
  @RequirePermissions('usuarios')
  @ApiOperation({ summary: 'Obtener permisos de un usuario' })
  @ApiResponse({ status: 200, description: 'Permisos del usuario' })
  async getPermisos(@Param('id') id: number) {
    return this.usuariosService.getPermisos(id);
  }

  @Post(":id/modulos")
  @RequirePermissions("usuarios")
  @Roles("superusuario", "administrador")
  @ApiOperation({ summary: "Asignar o revocar módulo a usuario" })
  @ApiResponse({ status: 200, description: "Módulo asignado/revocado exitosamente" })
  async asignarModulo(@Param('id') id: number, @Body() asignarModuloDto: AsignarModuloDto) {
    return this.usuariosService.asignarModulo(id, asignarModuloDto)
  }
}
