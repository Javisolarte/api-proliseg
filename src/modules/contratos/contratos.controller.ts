import {
  Controller, Get, Post, Put, Delete, Body, Param, UseGuards
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody
} from '@nestjs/swagger';
import { ContratosService } from './contratos.service';
import { CreateContratoDto, UpdateContratoDto } from './dto/contrato.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RlsHelperService } from '../../common/services/rls-helper.service';

@ApiTags('Contratos')
@Controller('contratos')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth('JWT-auth')
export class ContratosController {
  constructor(
    private readonly contratosService: ContratosService,
    private readonly rlsHelper: RlsHelperService,
  ) { }

  @Get()
  @RequirePermissions('contratos.read')
  @ApiOperation({ summary: 'Listar todos los contratos' })
  @ApiResponse({ status: 200, description: 'Lista de contratos' })
  async findAll(@CurrentUser() user: any) {
    const rlsContext = this.rlsHelper.createRlsContext(user);
    return this.contratosService.findAll(rlsContext);
  }

  @Get(':id')
  @RequirePermissions('contratos.read')
  @ApiOperation({ summary: 'Obtener contrato por ID' })
  @ApiResponse({ status: 200, description: 'Contrato encontrado' })
  async findOne(@Param('id') id: number, @CurrentUser() user: any) {
    const rlsContext = this.rlsHelper.createRlsContext(user);
    return this.contratosService.findOne(id, rlsContext);
  }

  @Post()
  @RequirePermissions('contratos.write')
  @ApiOperation({ summary: 'Crear nuevo contrato' })
  @ApiBody({ type: CreateContratoDto })
  @ApiResponse({ status: 201, description: 'Contrato creado exitosamente' })
  async create(@Body() createContratoDto: CreateContratoDto) {
    return this.contratosService.create(createContratoDto);
  }

  @Put(':id')
  @RequirePermissions('contratos.write')
  @ApiOperation({ summary: 'Actualizar contrato' })
  @ApiBody({ type: UpdateContratoDto })
  @ApiResponse({ status: 200, description: 'Contrato actualizado exitosamente' })
  async update(
    @Param('id') id: number,
    @Body() updateContratoDto: UpdateContratoDto,
    @CurrentUser() user: any,
  ) {
    const rlsContext = this.rlsHelper.createRlsContext(user);
    return this.contratosService.update(id, updateContratoDto, rlsContext);
  }

  @Delete(':id')
  @RequirePermissions('contratos.delete')
  @ApiOperation({ summary: 'Eliminar contrato' })
  @ApiResponse({ status: 200, description: 'Contrato eliminado exitosamente' })
  async remove(@Param('id') id: number, @CurrentUser() user: any) {
    const rlsContext = this.rlsHelper.createRlsContext(user);
    return this.contratosService.remove(id, rlsContext);
  }

  @Get(':id/puestos')
  @RequirePermissions('contratos.read', 'puestos_trabajo.read')
  @ApiOperation({ summary: 'Obtener puestos de trabajo de un contrato' })
  @ApiResponse({ status: 200, description: 'Lista de puestos' })
  async getPuestos(@Param('id') id: number, @CurrentUser() user: any) {
    const rlsContext = this.rlsHelper.createRlsContext(user);
    return this.contratosService.getPuestos(id, rlsContext);
  }
}
