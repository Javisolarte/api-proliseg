import { Module } from "@nestjs/common"
import { IncidentesController } from "./incidentes.controller"
import { IncidentesService } from "./incidentes.service"
import { SupabaseModule } from "../supabase/supabase.module"
import { AuthModule } from "../auth/auth.module"

@Module({
  imports: [SupabaseModule, AuthModule],
  controllers: [IncidentesController],
  providers: [IncidentesService],
  exports: [IncidentesService],
})
export class IncidentesModule { }

