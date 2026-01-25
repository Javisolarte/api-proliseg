import { Module } from '@nestjs/common';
import { UbicacionesService } from './ubicaciones.service';
import { UbicacionesController } from './ubicaciones.controller';
import { UbicacionesGateway } from './ubicaciones.gateway';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [SupabaseModule, AuthModule],
    controllers: [UbicacionesController],
    providers: [UbicacionesService, UbicacionesGateway],
    exports: [UbicacionesService],
})
export class UbicacionesModule { }
