import { Controller, Get, Delete, Post, Body, Query, Logger } from '@nestjs/common';
import {
    HealthCheck,
    HealthCheckService,
    MemoryHealthIndicator,
} from '@nestjs/terminus';
import { RedisHealthIndicator } from './indicators/redis.indicator';
import { SupabaseHealthIndicator } from './indicators/supabase.indicator';
import { MikrotikInternetService } from './mikrotik-internet.service';
import { SystemLoggerService } from './system-logger.service';
import { Public } from '../auth/decorators/public.decorator';

@Public()
@Controller('health')
export class HealthController {
    private readonly logger = new Logger(HealthController.name);

    constructor(
        private health: HealthCheckService,
        private memory: MemoryHealthIndicator,
        private redis: RedisHealthIndicator,
        private supabase: SupabaseHealthIndicator,
        private mikrotikInternet: MikrotikInternetService,
        private sysLogger: SystemLoggerService,
    ) { }

    @Get()
    @HealthCheck()
    check() {
        return this.health.check([
            () => this.memory.checkHeap('memory_heap', 3000 * 1024 * 1024),
            () => this.redis.isHealthy('redis'),
        ]);
    }

    @Get('db')
    @HealthCheck()
    checkDatabase() {
        return this.health.check([
            () => this.supabase.isHealthy('supabase'),
            () => this.redis.isHealthy('redis_cache'),
        ]);
    }

    @Get('redis')
    @HealthCheck()
    checkRedis() {
        return this.health.check([
            () => this.redis.isHealthy('redis'),
        ]);
    }

    @Get('queues')
    @HealthCheck()
    checkQueues() {
        return this.health.check([
            () => this.redis.isHealthy('redis'),
        ]);
    }

    @Get('servidores-internet')
    async getServidoresInternet() {
        this.logger.log('🌐 [INTERNET-CHECK] Verificando estado de internet de servidores MikroTik...');
        this.sysLogger.addLog('INFO', 'MikrotikInternet', 'Iniciando escaneo de conectividad e internet en servidores MikroTik');
        return this.mikrotikInternet.checkAllServersInternet();
    }

    @Get('logs')
    async getSystemLogs(
        @Query('level') level?: string,
        @Query('search') search?: string,
        @Query('limit') limit?: string,
    ) {
        return this.sysLogger.getLogs({
            level,
            search,
            limit: limit ? parseInt(limit, 10) : 300,
        });
    }

    @Delete('logs')
    async clearSystemLogs() {
        this.sysLogger.clearLogs();
        return { message: 'Logs limpiados correctamente' };
    }

    @Post('logs')
    async addSystemLog(@Body() body: { level?: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'; context?: string; message: string }) {
        return this.sysLogger.addLog(
            body.level || 'INFO',
            body.context || 'ClientConsole',
            body.message,
        );
    }
}
