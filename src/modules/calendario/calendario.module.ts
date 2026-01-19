import { Module } from '@nestjs/common';
import { CalendarioService } from './calendario.service';
import { CalendarioController } from './calendario.controller';
import { CalendarioScheduler } from './calendario.scheduler';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [SupabaseModule, AuthModule],
    controllers: [CalendarioController],
    providers: [CalendarioService, CalendarioScheduler],
    exports: [CalendarioService]
})
export class CalendarioModule { }
