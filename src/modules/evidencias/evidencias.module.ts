import { Module } from '@nestjs/common';
import { EvidenciasService } from './evidencias.service';
import { EvidenciasController } from './evidencias.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [SupabaseModule, AuthModule],
    controllers: [EvidenciasController],
    providers: [EvidenciasService],
})
export class EvidenciasModule { }
