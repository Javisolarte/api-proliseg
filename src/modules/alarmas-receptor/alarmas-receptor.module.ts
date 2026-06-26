import { Module } from '@nestjs/common';
import { AlarmasReceptorService } from './alarmas-receptor.service';
import { AlarmasService } from './alarmas.service';
import { AlarmasController } from './alarmas.controller';
import { ControlAccesoModule } from '../control-acceso/control-acceso.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { IntelbrasStrategy } from './strategies/intelbras.strategy';
import { AlarmStrategyFactory } from './strategies/alarm-strategy.factory';
import { AlarmasGatewayService } from './alarmas-gateway.service';

@Module({
  imports: [ControlAccesoModule, SupabaseModule],
  controllers: [AlarmasController],
  providers: [AlarmasReceptorService, AlarmasService, IntelbrasStrategy, AlarmStrategyFactory, AlarmasGatewayService],
  exports: [AlarmasReceptorService, AlarmasService, IntelbrasStrategy, AlarmStrategyFactory, AlarmasGatewayService],
})
export class AlarmasReceptorModule {}
