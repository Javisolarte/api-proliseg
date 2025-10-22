import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from "@nestjs/swagger";
import { EpsService } from "./eps.service";
import { CreateEpsDto, UpdateEpsDto } from "./dto/eps.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";

@ApiTags("EPS")
@Controller("eps")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class EpsController {
  constructor(private readonly epsService: EpsService) {}

  @Get()
  @RequirePermissions("eps")
  @ApiOperation({ summary: "Listar todas las EPS" })
  async findAll() { return this.epsService.findAll(); }

  @Get(":id")
  @RequirePermissions("eps")
  @ApiOperation({ summary: "Obtener EPS por ID" })
  async findOne(@Param("id") id: string) { return this.epsService.findOne(Number(id)); }

  @Post()
  @RequirePermissions("eps")
  @ApiOperation({ summary: "Crear nueva EPS" })
  @ApiBody({ type: CreateEpsDto })
  async create(@Body() createEpsDto: CreateEpsDto) { return this.epsService.create(createEpsDto); }

  @Put(":id")
  @RequirePermissions("eps")
  @ApiOperation({ summary: "Actualizar EPS" })
  async update(@Param("id") id: string, @Body() updateEpsDto: UpdateEpsDto) {
    return this.epsService.update(Number(id), updateEpsDto);
  }

  @Delete(":id")
  @RequirePermissions("eps")
  @ApiOperation({ summary: "Eliminar EPS" })
  async remove(@Param("id") id: string) {
    return this.epsService.remove(Number(id));
  }
}
