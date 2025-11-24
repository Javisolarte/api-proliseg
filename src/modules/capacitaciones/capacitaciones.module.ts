import { Module } from "@nestjs/common"
import { CapacitacionesController } from "./capacitaciones.controller"
import { CapacitacionesService } from "./capacitaciones.service"
import { SupabaseModule } from "../supabase/supabase.module"
import { AuthModule } from "../auth/auth.module"

@Module({
  imports: [SupabaseModule, AuthModule],
  controllers: [CapacitacionesController],
  providers: [CapacitacionesService],
  exports: [CapacitacionesService],
})
export class CapacitacionesModule { }
