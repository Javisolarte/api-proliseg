import { Module } from "@nestjs/common"
import { NovedadesController } from "./novedades.controller"
import { NovedadesService } from "./novedades.service"
import { SupabaseModule } from "../supabase/supabase.module"
import { AuthModule } from "../auth/auth.module"

@Module({
  imports: [SupabaseModule, AuthModule],
  controllers: [NovedadesController],
  providers: [NovedadesService],
  exports: [NovedadesService],
})
export class NovedadesModule { }

