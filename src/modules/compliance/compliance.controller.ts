import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ComplianceService } from './compliance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Compliance & Legal')
@Controller('compliance')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth('JWT-auth')
export class ComplianceController {
    constructor(private readonly complianceService: ComplianceService) { }

    @Get('verify/:entidad/:id')
    @RequirePermissions('admin')
    @ApiOperation({ summary: 'Verificar integridad de un registro crítico via Hash' })
    async verifyIntegrity(
        @Param('entidad') entidad: string,
        @Param('id') id: string,
        @Query('hash') hash: string
    ) {
        return this.complianceService.verifyRecordIntegrity(entidad, id, hash);
    }

    @Post('soft-delete/:entidad/:id')
    @RequirePermissions('admin', 'borrar')
    @ApiOperation({ summary: 'Realizar borrado lógico legal' })
    async softDelete(
        @Param('entidad') entidad: string,
        @Param('id') id: string,
        @Body() body: { motivo: string },
        @CurrentUser() user: any
    ) {
        return this.complianceService.softDelete(entidad, id, user.id, body.motivo);
    }

    @Get('audit-logs')
    @RequirePermissions('admin')
    @ApiOperation({ summary: 'Consultar logs legales inmutables' })
    async getAuditLogs(@Query('entidad') entidad?: string) {
        // Implementación de consulta a audit_legal_log via service
    }
}
