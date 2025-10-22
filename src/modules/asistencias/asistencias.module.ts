import { Module } from "@nestjs/common";
import { AsistenciasController } from "./asistencias.controller";
import { AsistenciasService } from "./asistencias.service";
import { AuthModule } from "../auth/auth.module"; // ✅ Permite usar guards y AuthService
import { SupabaseService } from "../supabase/supabase.service"; // ✅ Conexión con Supabase
import { GeminiService } from "../ia/gemini.service"; // ✅ IA de Google Gemini

@Module({
  imports: [AuthModule], // 🔐 Importamos autenticación
  controllers: [AsistenciasController],
  providers: [
    AsistenciasService,
    SupabaseService, // 🗄️ Base de datos
    GeminiService,   // 🤖 IA para análisis de comportamiento
  ],
  exports: [AsistenciasService],
})
export class AsistenciasModule {}
