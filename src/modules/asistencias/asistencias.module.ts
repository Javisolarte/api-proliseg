import { Module } from "@nestjs/common";
import { AsistenciasController } from "./asistencias.controller";
import { AsistenciasService } from "./asistencias.service";
import { AuthModule } from "../auth/auth.module"; // ✅ Importar AuthModule

@Module({
  imports: [AuthModule], // 🔥 Permite usar autenticación y guards en este módulo
  controllers: [AsistenciasController],
  providers: [AsistenciasService],
  exports: [AsistenciasService],
})
export class AsistenciasModule {}
