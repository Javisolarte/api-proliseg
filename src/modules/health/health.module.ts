import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './indicators/redis.indicator';
import { SupabaseHealthIndicator } from './indicators/supabase.indicator';
import { MikrotikInternetService } from './mikrotik-internet.service';
import { SystemLoggerService } from './system-logger.service';

@Module({
    imports: [TerminusModule],
    controllers: [HealthController],
    providers: [
        RedisHealthIndicator,
        SupabaseHealthIndicator,
        MikrotikInternetService,
        SystemLoggerService,
    ],
    exports: [SystemLoggerService],
})
export class HealthModule { }

