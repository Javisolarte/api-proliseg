import { Module } from "@nestjs/common"
import { IncidentesController } from "./incidentes.controller"
import { IncidentesService } from "./incidentes.service"

@Module({
  controllers: [IncidentesController],
  providers: [IncidentesService],
  exports: [IncidentesService],
})
export class IncidentesModule {}
