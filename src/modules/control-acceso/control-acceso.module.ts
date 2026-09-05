import { Module } from '@nestjs/common';
import { ControlAccesoService } from './control-acceso.service';
import { ControlAccesoController } from './control-acceso.controller';
import { ResidentesAppController } from './residentes-app.controller';
import { DevicePollerService } from './device-poller.service';
import { DahuaService } from './dahua.service';
import { DahuaSipService } from './dahua-sip.service';

@Module({
  controllers: [ControlAccesoController, ResidentesAppController],
  providers: [ControlAccesoService, DevicePollerService, DahuaService, DahuaSipService],
  exports: [ControlAccesoService, DevicePollerService, DahuaService, DahuaSipService],
})
export class ControlAccesoModule {}
