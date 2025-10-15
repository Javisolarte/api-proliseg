import { Module } from "@nestjs/common";
import { ContratosController } from "./contratos.controller";
import { ContratosService } from "./contratos.service";
import { AuthModule } from "../auth/auth.module"; // ✅ Importar AuthModule para usar guards y AuthService

@Module({
  imports: [AuthModule], // 🔥 Permite usar autenticación/autorización en este módulo
  controllers: [ContratosController],
  providers: [ContratosService],
  exports: [ContratosService],
})
export class ContratosModule {}
