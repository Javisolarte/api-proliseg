import { Module } from '@nestjs/common';
import { VehiculosService } from './vehiculos.service';
import { VehiculosController, VehiculosAsignacionController } from './vehiculos.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [SupabaseModule, AuthModule],
    controllers: [VehiculosController, VehiculosAsignacionController],
    providers: [VehiculosService],
    exports: [VehiculosService],
})
export class VehiculosModule { }
