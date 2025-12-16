import { Module } from "@nestjs/common";
import { NotificacionesController } from "./notificaciones.controller";
import { NotificacionesService } from "./notificaciones.service";
import { NotificacionesScheduler } from "./notificaciones.scheduler";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [NotificacionesController],
  providers: [NotificacionesService, NotificacionesScheduler],
  exports: [NotificacionesService],
})
export class NotificacionesModule { }
