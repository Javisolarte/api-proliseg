import { Module } from '@nestjs/common';
import { ComunicacionesService } from './comunicaciones.service';
import { ComunicacionesController } from './comunicaciones.controller';
import { PublicComunicacionesController } from './public-comunicaciones.controller';
import { ComunicacionesGateway } from './comunicaciones.gateway';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [SupabaseModule, AuthModule],
    controllers: [ComunicacionesController, PublicComunicacionesController],
    providers: [ComunicacionesService, ComunicacionesGateway],
    exports: [ComunicacionesService, ComunicacionesGateway],
})
export class ComunicacionesModule { }
