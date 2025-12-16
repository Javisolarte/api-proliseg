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

  @Get(':id/guardas-requeridos')
  @RequirePermissions('contratos.read')
  @ApiOperation({
    summary: 'Obtener cálculo de guardas requeridos del contrato',
    description: 'Retorna guardas activos, guardas necesarios calculados según ciclos de turnos, empleados asignados y cupos disponibles'
  })
  @ApiResponse({
    status: 200,
    description: 'Cálculo de guardas requeridos',
    schema: {
      example: {
        contrato_id: 1,
        total_guardas_activos: 5,
        total_guardas_necesarios: 15,
        total_empleados_asignados: 12,
        cupos_disponibles: 3
      }
    }
  })
  async getGuardasRequeridos(@Param('id') id: number, @CurrentUser() user: any) {
    const rlsContext = this.rlsHelper.createRlsContext(user);
    return this.contratosService.getGuardasRequeridos(id, rlsContext);
  }

  @Get(':id/resumen-guardas')
  @RequirePermissions('contratos.read')
  @ApiOperation({
    summary: 'Obtener resumen detallado de guardas del contrato',
    description: 'Retorna un resumen completo mostrando guardas del contrato, guardas asignados en subpuestos, empleados asignados y cupos disponibles por puesto y subpuesto'
  })
  @ApiResponse({
    status: 200,
    description: 'Resumen de guardas',
    schema: {
      example: {
        contrato_id: 1,
        cliente: "Empresa ABC",
        guardas_activos_contrato: 10,
        guardas_asignados_subpuestos: 8,
        guardas_disponibles_contrato: 2,
        empleados_asignados_total: 7,
        puestos: [
          {
            id: 1,
            nombre: "Sede Principal",
            total_guardas: 5,
            total_asignados: 4,
            subpuestos: [
              {
                id: 1,
                nombre: "Entrada Principal",
                guardas_activos: 3,
                empleados_asignados: 3,
                cupos_disponibles: 0
              },
              {
                id: 2,
                nombre: "Parqueadero",
                guardas_activos: 2,
                empleados_asignados: 1,
                cupos_disponibles: 1
              }
            ]
          }
        ]
      }
    }
  })
  async getResumenGuardas(@Param('id') id: number) {
    return this.contratosService.getResumenGuardas(id);
  }
}
