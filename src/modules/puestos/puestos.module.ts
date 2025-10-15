import { Module } from "@nestjs/common"
import { PuestosController } from "./puestos.controller"
import { PuestosService } from "./puestos.service"

@Module({
  controllers: [PuestosController],
  providers: [PuestosService],
  exports: [PuestosService],
})
export class PuestosModule {}
