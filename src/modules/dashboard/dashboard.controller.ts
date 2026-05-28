import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RlsHelperService } from '../../common/services/rls-helper.service';
import type { VigilanteDashboardDto, ClienteDashboardDto, AdminDashboardDto, RecentActivityDto } from './dto/dashboard.dto';

/**
 * 📊 CONTROLADOR DE DASHBOARD
 * 
 * Endpoints para obtener métricas del dashboard según el rol del usuario:
 * - Vigilante: Solo sus propios datos
 * - Cliente: Solo datos de sus contratos
 * - Administrativo/Gerencia/Superusuario: Todos los datos
 */
@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth('JWT-auth')
export class DashboardController {
    constructor(
        private readonly dashboardService: DashboardService,
        private readonly rlsHelper: RlsHelperService,
    ) { }

    @Get()
    @ApiOperation({
        summary: 'Obtener dashboard según rol del usuario',
        description: `
      Retorna métricas personalizadas según el rol:
      - **Vigilante**: Turnos, asistencias, novedades propias
      - **Cliente**: Contratos, puestos, guardas, incidentes de sus contratos
      - **Admin/Gerencia/Superusuario**: Métricas generales de toda la empresa
    `,
    })
    @ApiResponse({
        status: 200,
        description: 'Dashboard obtenido exitosamente',
    })
    async getDashboard(
        @CurrentUser() user: any,
    ): Promise<VigilanteDashboardDto | ClienteDashboardDto | AdminDashboardDto> {
        const rlsContext = this.rlsHelper.createRlsContext(user);
        return this.dashboardService.getDashboard(rlsContext);
    }

    @Get('actividad-reciente')
    @ApiOperation({
        summary: 'Obtener actividad reciente según rol del usuario',
        description: 'Retorna la lista de actividad reciente de forma ultra-rápida y ligera para feeds en tiempo real',
    })
    @ApiResponse({
        status: 200,
        description: 'Actividad reciente obtenida exitosamente',
    })
    async getRecentActivity(
        @CurrentUser() user: any,
    ): Promise<RecentActivityDto[]> {
        const rlsContext = this.rlsHelper.createRlsContext(user);
        return this.dashboardService.getRecentActivity(rlsContext);
    }
}
