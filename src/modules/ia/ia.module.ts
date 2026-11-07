import { Module } from '@nestjs/common';
import { IaController } from './ia.controller';
import { IaService } from './ia.service';
import { GeminiService } from './gemini.service';
import { CatorceBrainService } from './catorce-brain.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    SupabaseModule,
    AuthModule,
  ],
  controllers: [IaController],
  providers: [IaService, GeminiService, CatorceBrainService],
  exports: [IaService, GeminiService, CatorceBrainService],
})
export class IaModule {}
