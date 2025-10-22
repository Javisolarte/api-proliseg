import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from "@nestjs/swagger";
import { FondosPensionService } from "./fondos_pension.service";
import { CreateFondoPensionDto, UpdateFondoPensionDto } from "./dto/fondos_pension.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";

@ApiTags("Fondos de Pensión")
@Controller("fondos-pension")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class FondosPensionController {
  constructor(private readonly fondosPensionService: FondosPensionService) {}

  @Get()
  @RequirePermissions("fondos-pension")
  @ApiOperation({ summary: "Listar todos los fondos de pensión" })
  async findAll() { return this.fondosPensionService.findAll(); }

  @Get(":id")
  @RequirePermissions("fondos-pension")
  @ApiOperation({ summary: "Obtener fondo de pensión por ID" })
  async findOne(@Param("id") id: string) { return this.fondosPensionService.findOne(Number(id)); }

  @Post()
  @RequirePermissions("fondos-pension")
  @ApiOperation({ summary: "Crear nuevo fondo de pensión" })
  @ApiBody({ type: CreateFondoPensionDto })
  async create(@Body() createFondoPensionDto: CreateFondoPensionDto) { 
    return this.fondosPensionService.create(createFondoPensionDto); 
  }

  @Put(":id")
  @RequirePermissions("fondos-pension")
  @ApiOperation({ summary: "Actualizar fondo de pensión" })
  async update(@Param("id") id: string, @Body() updateFondoPensionDto: UpdateFondoPensionDto) {
    return this.fondosPensionService.update(Number(id), updateFondoPensionDto);
  }

  @Delete(":id")
  @RequirePermissions("fondos-pension")
  @ApiOperation({ summary: "Eliminar fondo de pensión" })
  async remove(@Param("id") id: string) {
    return this.fondosPensionService.remove(Number(id));
  }
}
