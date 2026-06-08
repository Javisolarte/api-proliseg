import { Module } from '@nestjs/common';
import { ControlAccesoService } from './control-acceso.service';
import { ControlAccesoController } from './control-acceso.controller';
import { ResidentesAppController } from './residentes-app.controller';
import { DevicePollerService } from './device-poller.service';

@Module({
  controllers: [ControlAccesoController, ResidentesAppController],
  providers: [ControlAccesoService, DevicePollerService],
  exports: [ControlAccesoService, DevicePollerService],
})
export class ControlAccesoModule {}
