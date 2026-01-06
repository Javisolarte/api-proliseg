import { Module } from '@nestjs/common';
import { MonitoreoService } from './monitoreo.service';
import { MonitoreoController } from './monitoreo.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [SupabaseModule, AuthModule],
    controllers: [MonitoreoController],
    providers: [MonitoreoService],
    exports: [MonitoreoService],
})
export class MonitoreoModule { }
