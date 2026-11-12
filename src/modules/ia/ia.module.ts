import { Module } from '@nestjs/common';
import { IaController } from './ia.controller';
import { IaService } from './ia.service';
import { GeminiService } from './gemini.service';
import { CatorceBrainService } from './catorce-brain.service';
import { CatorceSentinelService } from './catorce-sentinel.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';
import { ControlAccesoModule } from '../control-acceso/control-acceso.module';

@Module({
  imports: [
    SupabaseModule,
    AuthModule,
    ControlAccesoModule,
  ],
  controllers: [IaController],
  providers: [IaService, GeminiService, CatorceBrainService, CatorceSentinelService],
  exports: [IaService, GeminiService, CatorceBrainService, CatorceSentinelService],
})
export class IaModule {}
