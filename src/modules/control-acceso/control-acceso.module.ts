import { Module } from '@nestjs/common';
import { ControlAccesoService } from './control-acceso.service';
import { ControlAccesoController } from './control-acceso.controller';

@Module({
  controllers: [ControlAccesoController],
  providers: [ControlAccesoService],
  exports: [ControlAccesoService],
})
export class ControlAccesoModule {}
