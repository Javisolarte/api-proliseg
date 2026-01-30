import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { SupabaseModule } from '../supabase/supabase.module';

import { AuthModule } from '../auth/auth.module';
@Module({
    imports: [SupabaseModule, AuthModule],
    controllers: [JobsController],
    providers: [JobsService],
    exports: [JobsService],
})
export class JobsModule { }
