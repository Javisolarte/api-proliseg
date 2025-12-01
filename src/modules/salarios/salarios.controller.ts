import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from "@nestjs/swagger";
import { SalariosService } from "./salarios.service";
import { CreateSalarioDto, UpdateSalarioDto } from "./dto/salarios.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";

@ApiTags("Salarios")
@Controller("salarios")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth("JWT-auth")
export class SalariosController {
    constructor(private readonly salariosService: SalariosService) { }

    @Get()
    @RequirePermissions("salarios")
    @ApiOperation({ summary: "Listar todos los salarios" })
    @ApiResponse({ status: 200, description: "Lista de salarios obtenida exitosamente" })
    async findAll() { return this.salariosService.findAll(); }

    @Get(":id")
    @RequirePermissions("salarios")
    @ApiOperation({ summary: "Obtener salario por ID" })
    @ApiResponse({ status: 200, description: "Salario encontrado" })
    @ApiResponse({ status: 404, description: "Salario no encontrado" })
    async findOne(@Param("id") id: string) { return this.salariosService.findOne(Number(id)); }

    @Post()
    @RequirePermissions("salarios")
    @ApiOperation({ summary: "Crear nuevo salario" })
    @ApiBody({ type: CreateSalarioDto })
    @ApiResponse({ status: 201, description: "Salario creado exitosamente" })
    async create(@Body() createSalarioDto: CreateSalarioDto) { return this.salariosService.create(createSalarioDto); }

    @Put(":id")
    @RequirePermissions("salarios")
    @ApiOperation({ summary: "Actualizar salario" })
    @ApiResponse({ status: 200, description: "Salario actualizado exitosamente" })
    @ApiResponse({ status: 404, description: "Salario no encontrado" })
    async update(@Param("id") id: string, @Body() updateSalarioDto: UpdateSalarioDto) {
        return this.salariosService.update(Number(id), updateSalarioDto);
    }

    @Delete(":id")
    @RequirePermissions("salarios")
    @ApiOperation({ summary: "Eliminar salario" })
    @ApiResponse({ status: 200, description: "Salario eliminado exitosamente" })
    @ApiResponse({ status: 404, description: "Salario no encontrado" })
    async remove(@Param("id") id: string) {
        return this.salariosService.remove(Number(id));
    }
}
