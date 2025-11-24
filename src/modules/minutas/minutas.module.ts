import { Module } from "@nestjs/common"
import { MinutasController } from "./minutas.controller"
import { MinutasService } from "./minutas.service"
import { SupabaseModule } from "../supabase/supabase.module"
import { AuthModule } from "../auth/auth.module"

@Module({
  imports: [SupabaseModule, AuthModule],
  controllers: [MinutasController],
  providers: [MinutasService],
  exports: [MinutasService],
})
export class MinutasModule { }
