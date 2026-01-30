import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import type { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
    constructor(
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) {
        super();
    }

    async isHealthy(key: string): Promise<HealthIndicatorResult> {
        try {
            // Try to set and get a test value
            const testKey = '__health_check__';
            const testValue = Date.now().toString();

            await this.cacheManager.set(testKey, testValue, 10);
            const retrieved = await this.cacheManager.get(testKey);

            if (retrieved === testValue) {
                return this.getStatus(key, true);
            }

            throw new Error('Redis value mismatch');
        } catch (error) {
            throw new HealthCheckError(
                'Redis check failed',
                this.getStatus(key, false, { message: error.message }),
            );
        }
    }
}
