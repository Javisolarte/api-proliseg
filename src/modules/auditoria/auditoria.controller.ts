import { Controller, Get, Post, Body, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger";
import { AuditoriaService } from "./auditoria.service";
import { CreateAuditoriaDto } from "./dto/auditoria.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";

@ApiTags("Auditoria")
@Controller("auditoria")
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
    @ApiOperation({ summary: "Listar registros de auditoría" })
    async findAll() {
        return this.auditoriaService.findAll();
    }

    @Get(":id")
    @RequirePermissions("auditoria")
    @ApiOperation({ summary: "Obtener registro de auditoría por ID" })
    async findOne(@Param("id") id: number) {
        return this.auditoriaService.findOne(id);
    }
}
