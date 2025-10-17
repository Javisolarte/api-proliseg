import { Module } from "@nestjs/common";
import { TurnosConfiguracionController } from "./turnos_configuracion.controller";
import { TurnosConfiguracionService } from "./turnos_configuracion.service";
import { AuthModule } from "../auth/auth.module";
import { SupabaseModule } from "../supabase/supabase.module";

@Module({
  imports: [AuthModule, SupabaseModule],
  controllers: [TurnosConfiguracionController],
  providers: [TurnosConfiguracionService],
  exports: [TurnosConfiguracionService],
})
export class TurnosConfiguracionModule {}
