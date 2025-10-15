import { Module } from "@nestjs/common";
import { TurnosController } from "./turnos.controller";
import { TurnosService } from "./turnos.service";
import { AuthModule } from "../auth/auth.module"; // ✅ Importar AuthModule para usar guards y AuthService

@Module({
  imports: [AuthModule], // 🔥 Permite proteger rutas y usar AuthService
  controllers: [TurnosController],
  providers: [TurnosService],
  exports: [TurnosService],
})
export class TurnosModule {}
