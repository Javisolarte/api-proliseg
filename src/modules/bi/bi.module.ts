import { Module } from '@nestjs/common';
import { BiService } from './bi.service';
import { BiController } from './bi.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { SupabaseModule } from '../supabase/supabase.module';

import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [AuthModule],
    controllers: [BiController, AnalyticsController],
    providers: [BiService, AnalyticsService],
    exports: [BiService, AnalyticsService]
})
export class BiModule { }
