import { Controller, Get } from '@nestjs/common';
import {
    HealthCheck,
    HealthCheckService,
    MemoryHealthIndicator,
} from '@nestjs/terminus';
import { RedisHealthIndicator } from './indicators/redis.indicator';
import { SupabaseHealthIndicator } from './indicators/supabase.indicator';

@Controller('health')
export class HealthController {
    constructor(
        private health: HealthCheckService,
        private memory: MemoryHealthIndicator,
        private redis: RedisHealthIndicator,
        private supabase: SupabaseHealthIndicator,
    ) { }

    @Get()
    @HealthCheck()
    check() {
        return this.health.check([
            () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
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
}
