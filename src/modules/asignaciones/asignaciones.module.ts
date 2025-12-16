import { Module } from "@nestjs/common";
import { AsignacionesController } from "./asignaciones.controller";
import { AsignacionesService } from "./asignaciones.service";
import { AuthModule } from "../auth/auth.module";
import { AsignarTurnosService } from "../asignar_turnos/asignar_turnos.service";
import { TurnosHelperService } from "../../common/helpers/turnos-helper.service";

@Module({
  imports: [AuthModule],
  controllers: [AsignacionesController],
  providers: [AsignacionesService, AsignarTurnosService, TurnosHelperService],
  exports: [TurnosHelperService], // Exportar para usar en otros módulos
})
export class AsignacionesModule { }
