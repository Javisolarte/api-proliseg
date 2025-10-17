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
import { PuestosService } from "./puestos.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CreatePuestoDto, UpdatePuestoDto } from "./dto/puesto.dto";
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";

@ApiTags("Puestos")
@Controller("puestos")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class PuestosController {
  constructor(private readonly puestosService: PuestosService) {}

  @Get()
  @RequirePermissions("puestos")
  @ApiOperation({ summary: "Listar todos los puestos de trabajo" })
  findAll() {
    return this.puestosService.findAll();
  }

  @Get(":id")
  @RequirePermissions("puestos")
  @ApiOperation({ summary: "Obtener un puesto específico por ID" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.puestosService.findOne(id);
  }

  @Post()
  @RequirePermissions("puestos")
  @ApiOperation({ summary: "Crear un nuevo puesto de trabajo" })
  create(@Body() dto: CreatePuestoDto, @Request() req) {
    return this.puestosService.create(dto, req.user.id);
  }

  @Put(":id")
  @RequirePermissions("puestos")
  @ApiOperation({ summary: "Actualizar los datos de un puesto" })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdatePuestoDto,
    @Request() req
  ) {
    return this.puestosService.update(id, dto, req.user.id);
  }

  @Delete(":id")
  @RequirePermissions("puestos")
  @ApiOperation({ summary: "Eliminar (soft delete) un puesto" })
  softDelete(@Param("id", ParseIntPipe) id: number, @Request() req) {
    return this.puestosService.softDelete(id, req.user.id);
  }
}
