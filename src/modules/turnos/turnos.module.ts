import { Module } from "@nestjs/common";
import { TurnosController } from "./turnos.controller";
import { TurnosService } from "./turnos.service";
import { AuthModule } from "../auth/auth.module";
import { SupabaseModule } from "../supabase/supabase.module";

@Module({
  imports: [AuthModule, SupabaseModule],
  controllers: [TurnosController],
  providers: [TurnosService],
  exports: [TurnosService],
})
export class TurnosModule {}
