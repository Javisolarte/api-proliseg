import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SupabaseModule } from "../supabase/supabase.module";
import { ControlRondasController } from "./control-rondas.controller";
import { ControlRondasService } from "./control-rondas.service";

@Module({
  imports: [SupabaseModule, AuthModule],
  controllers: [ControlRondasController],
  providers: [ControlRondasService],
  exports: [ControlRondasService],
})
export class ControlRondasModule {}
