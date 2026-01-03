import { Module } from '@nestjs/common';
import { RutasService } from './rutas.service';
import {
    RutasController,
    RutasAsignacionController,
    RutasEjecucionController,
    RutasEventosController
} from './rutas.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [SupabaseModule, AuthModule],
    controllers: [
        RutasController,
        RutasAsignacionController,
        RutasEjecucionController,
        RutasEventosController
    ],
    providers: [RutasService],
    exports: [RutasService],
})
export class RutasModule { }
