import { Controller, Get, Post, Body, Param, Patch, Delete, ParseIntPipe } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { PermisosService } from "./permisos.service";
import { AsignarPermisoDto, ActualizarPermisoDto } from "./dto/permiso.dto";

@ApiTags("Permisos")
@Controller("permisos")
export class PermisosController {
  constructor(private readonly permisosService: PermisosService) {}

  @Get()
  @ApiOperation({ summary: "Listar todos los permisos asignados" })
  listar() {
    return this.permisosService.listarPermisos();
  }

  @Get("usuario/:usuario_id")
  @ApiOperation({ summary: "Listar permisos de un usuario específico" })
  listarPorUsuario(@Param("usuario_id", ParseIntPipe) usuario_id: number) {
    return this.permisosService.listarPermisosPorUsuario(usuario_id);
  }

  @Post()
  @ApiOperation({ summary: "Asignar un permiso (usuario ↔ módulo)" })
  asignar(@Body() dto: AsignarPermisoDto) {
    return this.permisosService.asignarPermiso(dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Actualizar el estado de un permiso" })
  actualizar(@Param("id", ParseIntPipe) id: number, @Body() dto: ActualizarPermisoDto) {
    return this.permisosService.actualizarPermiso(id, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Eliminar permiso asignado" })
  eliminar(@Param("id", ParseIntPipe) id: number) {
    return this.permisosService.eliminarPermiso(id);
  }
}
