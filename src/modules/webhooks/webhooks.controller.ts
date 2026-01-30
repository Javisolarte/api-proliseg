import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Webhooks')
@Controller('webhooks')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth('JWT-auth')
export class WebhooksController {
    constructor(private readonly webhooksService: WebhooksService) { }

    @Post('subscribe')
    @RequirePermissions('webhooks', 'crear')
    @ApiOperation({ summary: 'Suscribirse a eventos del sistema' })
    async subscribe(
        @Body() body: { url: string; events: string[]; puesto_id?: number; secret?: string }
    ) {
        return this.webhooksService.subscribe(body.puesto_id || null, body.url, body.events, body.secret);
    }
}
