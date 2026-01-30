import { Module } from '@nestjs/common';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';
import { SupabaseModule } from '../supabase/supabase.module';

import { AuthModule } from '../auth/auth.module';
@Module({
    imports: [SupabaseModule, AuthModule],
    controllers: [ExportController],
    providers: [ExportService],
    exports: [ExportService],
})
export class ExportModule { }
