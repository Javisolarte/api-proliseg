import { Module } from '@nestjs/common';
import { ControlAccesoService } from './control-acceso.service';
import { ControlAccesoController } from './control-acceso.controller';
import { DevicePollerService } from './device-poller.service';

@Module({
  controllers: [ControlAccesoController],
  providers: [ControlAccesoService, DevicePollerService],
  exports: [ControlAccesoService, DevicePollerService],
})
export class ControlAccesoModule {}
