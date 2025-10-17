import { Module } from "@nestjs/common";
import { PuestosController } from "./puestos.controller";
import { PuestosService } from "./puestos.service";
import { AuthModule } from "../auth/auth.module";
import { SupabaseModule } from "../supabase/supabase.module";

@Module({
  imports: [AuthModule, SupabaseModule], // ✅ Igual que empleados
  controllers: [PuestosController],
  providers: [PuestosService],
  exports: [PuestosService],
})
export class PuestosModule {}
