import { Module } from "@nestjs/common";
import { NotificacionesController } from "./notificaciones.controller";
import { NotificacionesService } from "./notificaciones.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [NotificacionesController],
  providers: [NotificacionesService],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
