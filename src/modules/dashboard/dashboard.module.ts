import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';
import { RlsHelperService } from '../../common/services/rls-helper.service';

@Module({
    imports: [SupabaseModule, AuthModule],
    controllers: [DashboardController],
    providers: [DashboardService, RlsHelperService],
    exports: [DashboardService],
})
export class DashboardModule { }
