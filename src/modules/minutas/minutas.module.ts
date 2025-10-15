import { Module } from "@nestjs/common"
import { MinutasController } from "./minutas.controller"
import { MinutasService } from "./minutas.service"

@Module({
  controllers: [MinutasController],
  providers: [MinutasService],
  exports: [MinutasService],
})
export class MinutasModule {}
