import { Module } from "@nestjs/common";
import { PermisosService } from "./permisos.service";
import { PermisosController } from "./permisos.controller";
import { SupabaseService } from "../supabase/supabase.service";

@Module({
  controllers: [PermisosController],
  providers: [PermisosService, SupabaseService],
})
export class PermisosModule {}
