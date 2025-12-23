import { Module } from '@nestjs/common';
import { DotacionesController } from './dotaciones.controller';
import { DotacionesService } from './dotaciones.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [SupabaseModule, AuthModule],
    controllers: [DotacionesController],
    providers: [DotacionesService],
    exports: [DotacionesService],
})
export class DotacionesModule { }
