import { Module } from '@nestjs/common';
import { IaController } from './ia.controller';
import { IaService } from './ia.service';
import { GeminiService } from './gemini.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    SupabaseModule,
    AuthModule, // 🔐 Para autenticación del usuario
  ],
  controllers: [IaController],
  providers: [IaService, GeminiService], // ✅ Reemplazamos OpenAIService por GeminiService
  exports: [IaService, GeminiService],
})
export class IaModule { }
