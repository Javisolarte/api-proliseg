import { Module } from '@nestjs/common';
import { PoliticasService } from './politicas.service';
import { PoliticasController } from './politicas.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { ComplianceModule } from '../compliance/compliance.module';

@Module({
    imports: [SupabaseModule, ComplianceModule],
    controllers: [PoliticasController],
    providers: [PoliticasService],
    exports: [PoliticasService]
})
export class PoliticasModule { }
