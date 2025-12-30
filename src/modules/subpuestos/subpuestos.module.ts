import { Module } from "@nestjs/common";
import { SubpuestosController } from "./subpuestos.controller";
import { SubpuestosService } from "./subpuestos.service";
import { AuthModule } from "../auth/auth.module";
import { SupabaseModule } from "../supabase/supabase.module";

import { AsignarTurnosModule } from '../asignar_turnos/asignar_turnos.module';

@Module({
  imports: [AuthModule, SupabaseModule, AsignarTurnosModule],
  controllers: [SubpuestosController],
  providers: [SubpuestosService],
  exports: [SubpuestosService],
})
export class SubpuestosModule { }
