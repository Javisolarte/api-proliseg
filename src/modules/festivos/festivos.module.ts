import { Module } from '@nestjs/common';
import { FestivosCronService } from './festivos-cron.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
    imports: [SupabaseModule],
    providers: [FestivosCronService],
    exports: [FestivosCronService],
})
export class FestivosModule { }
