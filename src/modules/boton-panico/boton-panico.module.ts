import { Module } from '@nestjs/common';
import { BotonPanicoService } from './boton-panico.service';
import { BotonPanicoController } from './boton-panico.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [SupabaseModule, AuthModule],
    controllers: [BotonPanicoController],
    providers: [BotonPanicoService],
    exports: [BotonPanicoService],
})
export class BotonPanicoModule { }
