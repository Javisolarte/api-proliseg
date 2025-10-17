import { Module } from "@nestjs/common";
import { ServiciosController } from "./servicios.controller";
import { ServiciosService } from "./servicios.service";
import { AuthModule } from "../auth/auth.module";
import { SupabaseService } from "../supabase/supabase.service";

@Module({
  imports: [AuthModule],
  controllers: [ServiciosController],
  providers: [ServiciosService, SupabaseService],
  exports: [ServiciosService],
})
export class ServiciosModule {}
