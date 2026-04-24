import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ComunicacionesService } from './comunicaciones.service';
import { ComunicacionesController } from './comunicaciones.controller';
import { PublicComunicacionesController } from './public-comunicaciones.controller';
import { ComunicacionesGateway } from './comunicaciones.gateway';
import { LiveKitService } from './livekit.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [
        SupabaseModule, 
        AuthModule, 
        ConfigModule
    ],
    controllers: [
        ComunicacionesController, 
        PublicComunicacionesController
    ],
    providers: [
        ComunicacionesService, 
        ComunicacionesGateway, 
        LiveKitService
    ],
    exports: [
        ComunicacionesService, 
        ComunicacionesGateway, 
        LiveKitService
    ],
})
export class ComunicacionesModule { }
