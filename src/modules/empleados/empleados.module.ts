import { Module } from "@nestjs/common";
import { EmpleadosController } from "./empleados.controller";
import { EmpleadosService } from "./empleados.service";
import { AuthModule } from "../auth/auth.module"; // 🔥 Importar el módulo que provee AuthService y JwtAuthGuard

@Module({
  imports: [AuthModule], // ✅ Importamos AuthModule para que Nest resuelva AuthService en JwtAuthGuard
  controllers: [EmpleadosController],
  providers: [EmpleadosService],
  exports: [EmpleadosService],
})
export class EmpleadosModule {}
