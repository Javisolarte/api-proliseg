import { Module } from "@nestjs/common";
import { TurnosReemplazosController } from "./turnos_reemplazos.controller";
import { TurnosReemplazosService } from "./turnos_reemplazos.service";
import { AuthModule } from "../auth/auth.module";
import { IaModule } from "../ia/ia.module";

@Module({
  imports: [AuthModule, IaModule],
  controllers: [TurnosReemplazosController],
  providers: [TurnosReemplazosService],
  exports: [TurnosReemplazosService],
})
export class TurnosReemplazosModule { }
