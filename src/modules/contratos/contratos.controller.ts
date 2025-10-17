import { 
  Controller, Get, Post, Put, Delete, Body, Param, UseGuards 
} from '@nestjs/common';
import { 
  ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody 
} from '@nestjs/swagger';
import { ContratosService } from './contratos.service';
import { CreateContratoDto, UpdateContratoDto } from './dto/contrato.dto'; // 👈 quita el "type"
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Contratos')
@Controller('contratos')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth('JWT-auth')
export class ContratosController {
  constructor(private readonly contratosService: ContratosService) {}

  @Get()
  @RequirePermissions('contratos')
  @ApiOperation({ summary: 'Listar todos los contratos' })
  @ApiResponse({ status: 200, description: 'Lista de contratos' })
  async findAll() {
    return this.contratosService.findAll();
  }

  @Get(':id')
  @RequirePermissions('contratos')
  @ApiOperation({ summary: 'Obtener contrato por ID' })
  @ApiResponse({ status: 200, description: 'Contrato encontrado' })
  async findOne(@Param('id') id: number) {
    return this.contratosService.findOne(id);
  }

  @Post()
  @RequirePermissions('contratos')
  @ApiOperation({ summary: 'Crear nuevo contrato' })
  @ApiBody({ type: CreateContratoDto }) // 👈 AÑADIDO: ahora Swagger mostrará el ejemplo
  @ApiResponse({ status: 201, description: 'Contrato creado exitosamente' })
  async create(@Body() createContratoDto: CreateContratoDto) {
    return this.contratosService.create(createContratoDto);
  }

  @Put(':id')
  @RequirePermissions('contratos')
  @ApiOperation({ summary: 'Actualizar contrato' })
  @ApiBody({ type: UpdateContratoDto }) // 👈 AÑADIDO para PUT
  @ApiResponse({ status: 200, description: 'Contrato actualizado exitosamente' })
  async update(@Param('id') id: number, @Body() updateContratoDto: UpdateContratoDto) {
    return this.contratosService.update(id, updateContratoDto);
  }

  @Delete(':id')
  @RequirePermissions('contratos')
  @ApiOperation({ summary: 'Eliminar contrato' })
  @ApiResponse({ status: 200, description: 'Contrato eliminado exitosamente' })
  async remove(@Param('id') id: number) {
    return this.contratosService.remove(id);
  }

  @Get(':id/puestos')
  @RequirePermissions('contratos', 'puestos_trabajo')
  @ApiOperation({ summary: 'Obtener puestos de trabajo de un contrato' })
  @ApiResponse({ status: 200, description: 'Lista de puestos' })
  async getPuestos(@Param('id') id: number) {
    return this.contratosService.getPuestos(id);
  }
}
