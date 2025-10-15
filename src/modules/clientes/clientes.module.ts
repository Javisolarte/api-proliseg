import { Module } from "@nestjs/common";
import { ClientesController } from "./clientes.controller";
import { ClientesService } from "./clientes.service";
import { AuthModule } from "../auth/auth.module"; // ✅ Importa el AuthModule

@Module({
  imports: [AuthModule], // 🔥 Habilita guards y AuthService
  controllers: [ClientesController],
  providers: [ClientesService],
  exports: [ClientesService],
})
export class ClientesModule {}
