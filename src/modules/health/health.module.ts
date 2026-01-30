import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './indicators/redis.indicator';
import { SupabaseHealthIndicator } from './indicators/supabase.indicator';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
    imports: [TerminusModule],
    controllers: [HealthController],
    providers: [RedisHealthIndicator, SupabaseHealthIndicator],
})
export class HealthModule { }
