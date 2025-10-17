import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Delete,
  UseGuards,
  Request,
  ParseIntPipe,
} from "@nestjs/common";
import { SubpuestosService } from "./subpuestos.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CreateSubpuestoDto, UpdateSubpuestoDto } from "./dto/subpuesto.dto";
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from "@nestjs/swagger";

@ApiTags("Subpuestos")
@Controller("subpuestos")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class SubpuestosController {
  constructor(private readonly subpuestosService: SubpuestosService) {}

  @Get()
  @RequirePermissions("puestos")
  @ApiOperation({ summary: "Obtener todos los subpuestos" })
  @ApiResponse({ status: 200, description: "Lista de subpuestos obtenida" })
  findAll() {
    return this.subpuestosService.findAll();
  }

  @Get(":id")
  @RequirePermissions("puestos")
  @ApiOperation({ summary: "Obtener un subpuesto por ID" })
  @ApiResponse({ status: 200, description: "Subpuesto encontrado" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.subpuestosService.findOne(id);
  }

  @Post()
  @RequirePermissions("puestos")
  @ApiOperation({ summary: "Crear un nuevo subpuesto" })
  @ApiResponse({ status: 201, description: "Subpuesto creado exitosamente" })
  create(@Body() dto: CreateSubpuestoDto, @Request() req) {
    return this.subpuestosService.create(dto, req.user.id);
  }

  @Put(":id")
  @RequirePermissions("puestos")
  @ApiOperation({ summary: "Actualizar un subpuesto existente" })
  @ApiResponse({ status: 200, description: "Subpuesto actualizado exitosamente" })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateSubpuestoDto,
    @Request() req
  ) {
    return this.subpuestosService.update(id, dto, req.user.id);
  }

  @Delete(":id")
  @RequirePermissions("puestos")
  @ApiOperation({ summary: "Eliminar (soft delete) un subpuesto" })
  @ApiResponse({ status: 200, description: "Subpuesto eliminado exitosamente" })
  softDelete(@Param("id", ParseIntPipe) id: number, @Request() req) {
    return this.subpuestosService.softDelete(id, req.user.id);
  }
}
