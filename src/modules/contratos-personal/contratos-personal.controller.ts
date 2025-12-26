import {
    Body,
    Controller,
    Get,
    Param,
    ParseIntPipe,
    Post,
    Put,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ContratosPersonalService } from './contratos-personal.service';
import { CreateContratoPersonalDto } from './dto/create-contrato-personal.dto';
import { TerminateContratoPersonalDto } from './dto/terminate-contrato-personal.dto';
import { RenovarContratoDto } from './dto/renovar-contrato.dto';
import { UpdateContratoPersonalDto } from './dto/update-contrato-personal.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Contratos Personal')
@Controller('contratos-personal')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ContratosPersonalController {
    constructor(private readonly contratosService: ContratosPersonalService) { }

    @Post()
    @ApiOperation({ summary: 'Crear un nuevo contrato personal' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FileInterceptor('contrato_pdf'))
    async create(
        @Body() createDto: CreateContratoPersonalDto,
        @CurrentUser() user: any,
        @UploadedFile() file?: any,
    ) {
        return this.contratosService.create(createDto, user.id, file);
    }

    @Post('terminate')
    @ApiOperation({ summary: 'Terminar un contrato existente' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FileInterceptor('terminacion_pdf'))
    async terminate(
        @Body() terminateDto: TerminateContratoPersonalDto,
        @CurrentUser() user: any,
        @UploadedFile() file?: any,
    ) {
        return this.contratosService.terminate(terminateDto, user.id, file);
    }

    @Get('empleado/:id')
    @ApiOperation({ summary: 'Obtener historial de contratos de un empleado' })
    async getByEmpleado(@Param('id', ParseIntPipe) id: number) {
        return this.contratosService.getByEmpleado(id);
    }


    @Post('renovar')
    @ApiOperation({ summary: 'Renovar contrato existente' })
    async renew(@Body() dto: RenovarContratoDto, @CurrentUser() user: any) {
        return this.contratosService.renew(dto, user.id);
    }

    @Get('activos')
    @ApiOperation({ summary: 'Listar contratos activos' })
    async findActive() {
        return this.contratosService.findActive();
    }

    @Get('vencimientos')
    @ApiOperation({ summary: 'Listar contratos próximos a vencer (30 días)' })
    async findExpiring() {
        return this.contratosService.findExpiring();
    }

    @Get(':id')
    @ApiOperation({ summary: 'Obtener detalle de contrato' })
    async findOne(@Param('id', ParseIntPipe) id: number) {
        return this.contratosService.findOne(id);
    }

    @Get('validar-vencidos')
    @ApiOperation({ summary: 'Validar y actualizar contratos vencidos' })
    async validateExpired(@CurrentUser() user: any) {
        return this.contratosService.validateExpired(user.id);
    }

    @Get(':id/auditoria')
    @ApiOperation({ summary: 'Ver auditoría de un contrato' })
    async getAudit(@Param('id', ParseIntPipe) id: number) {
        return this.contratosService.getAudit(id);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Actualizar contrato (datos no legales)' })
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateContratoPersonalDto,
        @CurrentUser() user: any
    ) {
        return this.contratosService.update(id, dto, user.id);
    }
}
