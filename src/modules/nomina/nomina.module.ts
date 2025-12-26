import { Module } from '@nestjs/common';
import { NominaController } from './nomina.controller';
import { NominaService } from './nomina.service';
import { ParametrosNominaController } from './parametros/parametros-nomina.controller';
import { ParametrosNominaService } from './parametros/parametros-nomina.service';
import { DeduccionesNominaController } from './deducciones/deducciones-nomina.controller';
import { DeduccionesNominaService } from './deducciones/deducciones-nomina.service';
import { HorasNominaController } from './horas/horas-nomina.controller';
import { HorasNominaService } from './horas/horas-nomina.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [SupabaseModule, AuditoriaModule, AuthModule],
    controllers: [NominaController, ParametrosNominaController, DeduccionesNominaController, HorasNominaController],
    providers: [NominaService, ParametrosNominaService, DeduccionesNominaService, HorasNominaService],
    exports: [NominaService],
})
export class NominaModule { }
