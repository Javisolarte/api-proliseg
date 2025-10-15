// src/modules/usuarios/usuarios.module.ts
import { Module } from "@nestjs/common";
import { UsuariosController } from "./usuarios.controller";
import { UsuariosService } from "./usuarios.service";
import { AuthModule } from "../auth/auth.module"; // <-- IMPORTAR AuthModule
import { SupabaseModule } from "../supabase/supabase.module"; // si usas supabase aquí también

@Module({
  imports: [AuthModule, SupabaseModule], // <- AuthModule permite inyectar AuthService en guards
  controllers: [UsuariosController],
  providers: [UsuariosService],
  exports: [UsuariosService],
})
export class UsuariosModule {}
