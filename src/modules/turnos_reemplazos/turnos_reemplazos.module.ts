import { Module } from "@nestjs/common";
import { TurnosReemplazosController } from "./turnos_reemplazos.controller";
import { TurnosReemplazosService } from "./turnos_reemplazos.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [TurnosReemplazosController],
  providers: [TurnosReemplazosService],
  exports: [TurnosReemplazosService],
})
export class TurnosReemplazosModule {}
