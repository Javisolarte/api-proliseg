import { Module } from "@nestjs/common"
import { NovedadesController } from "./novedades.controller"
import { NovedadesService } from "./novedades.service"

@Module({
  controllers: [NovedadesController],
  providers: [NovedadesService],
  exports: [NovedadesService],
})
export class NovedadesModule {}
