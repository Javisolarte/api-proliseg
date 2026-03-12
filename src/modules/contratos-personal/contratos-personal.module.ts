import { Module } from '@nestjs/common';
import { ContratosPersonalService } from './contratos-personal.service';
import { ContratosPersonalController } from './contratos-personal.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { AuthModule } from '../auth/auth.module';
import { DocumentosGeneradosModule } from '../documentos-generados/documentos-generados.module';
import { FirmasModule } from '../firmas/firmas.module';

@Module({
    imports: [SupabaseModule, AuditoriaModule, AuthModule, DocumentosGeneradosModule, FirmasModule],
    controllers: [ContratosPersonalController],
    providers: [ContratosPersonalService],
    exports: [ContratosPersonalService],
})
export class ContratosPersonalModule { }
