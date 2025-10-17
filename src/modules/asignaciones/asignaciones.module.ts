import { Module } from "@nestjs/common";
import { AsignacionesController } from "./asignaciones.controller";
import { AsignacionesService } from "./asignaciones.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [AsignacionesController],
  providers: [AsignacionesService],
})
export class AsignacionesModule {}
