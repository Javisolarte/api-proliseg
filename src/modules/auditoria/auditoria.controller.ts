import { Controller, Get, Post, Body, Param, UseGuards, Query } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger";
import { AuditoriaService } from "./auditoria.service";
import { CreateAuditoriaDto, AuditoriaQueryDto } from "./dto/auditoria.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";

@ApiTags("Auditoria")
@Controller("api/auditoria")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class AuditoriaController {
    constructor(private readonly auditoriaService: AuditoriaService) { }

    @Post()
    @RequirePermissions("auditoria")
    @ApiOperation({ summary: "Crear registro de auditoría" })
    async create(@Body() createAuditoriaDto: CreateAuditoriaDto) {
        return this.auditoriaService.create(createAuditoriaDto);
    }

    @Get()
    @RequirePermissions("auditoria")
    @ApiOperation({ summary: "Listar registros de auditoría con filtros" })
    async findAll(@Query() query: AuditoriaQueryDto) {
        if (Object.keys(query).length > 0) {
            return this.auditoriaService.findWithFilters(query);
        }
        return this.auditoriaService.findAll();
    }

    @Get('usuario/:id')
    @RequirePermissions("auditoria")
    @ApiOperation({ summary: "Obtener auditoría por usuario" })
    async findByUsuario(@Param("id") id: number) {
        return this.auditoriaService.findByUsuario(id);
    }

    @Get('entidad/:tipo/:id')
    @RequirePermissions("auditoria")
    @ApiOperation({ summary: "Obtener auditoría por entidad" })
    async findByEntidad(@Param("tipo") tipo: string, @Param("id") id: number) {
        return this.auditoriaService.findByEntidad(tipo, id);
    }

    @Get(":id")
    @RequirePermissions("auditoria")
    @ApiOperation({ summary: "Obtener registro de auditoría por ID" })
    async findOne(@Param("id") id: number) {
        return this.auditoriaService.findOne(id);
    }
}
