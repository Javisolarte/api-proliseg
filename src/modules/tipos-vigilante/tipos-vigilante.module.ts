import { Module } from '@nestjs/common';
import { TiposVigilanteService } from './tipos-vigilante.service';
import { TiposVigilanteController } from './tipos-vigilante.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [SupabaseModule, AuthModule],
    controllers: [TiposVigilanteController],
    providers: [TiposVigilanteService],
    exports: [TiposVigilanteService],
})
export class TiposVigilanteModule { }
