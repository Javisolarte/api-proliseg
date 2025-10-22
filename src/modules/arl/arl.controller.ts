import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from "@nestjs/swagger";
import { ArlService } from "./arl.service";
import { CreateArlDto, UpdateArlDto } from "./dto/arl.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";

@ApiTags("ARL")
@Controller("arl")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class ArlController {
  constructor(private readonly arlService: ArlService) {}

  @Get()
  @RequirePermissions("arl")
  @ApiOperation({ summary: "Listar todas las ARL" })
  async findAll() { return this.arlService.findAll(); }

  @Get(":id")
  @RequirePermissions("arl")
  @ApiOperation({ summary: "Obtener ARL por ID" })
  async findOne(@Param("id") id: string) { return this.arlService.findOne(Number(id)); }

  @Post()
  @RequirePermissions("arl")
  @ApiOperation({ summary: "Crear nueva ARL" })
  @ApiBody({ type: CreateArlDto })
  async create(@Body() createArlDto: CreateArlDto) { return this.arlService.create(createArlDto); }

  @Put(":id")
  @RequirePermissions("arl")
  @ApiOperation({ summary: "Actualizar ARL" })
  async update(@Param("id") id: string, @Body() updateArlDto: UpdateArlDto) {
    return this.arlService.update(Number(id), updateArlDto);
  }

  @Delete(":id")
  @RequirePermissions("arl")
  @ApiOperation({ summary: "Eliminar ARL" })
  async remove(@Param("id") id: string) {
    return this.arlService.remove(Number(id));
  }
}
