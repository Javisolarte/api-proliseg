import { Module } from '@nestjs/common';
import { AlarmasReceptorService } from './alarmas-receptor.service';
import { AlarmasService } from './alarmas.service';
import { AlarmasController } from './alarmas.controller';
import { ControlAccesoModule } from '../control-acceso/control-acceso.module';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [ControlAccesoModule, SupabaseModule],
  controllers: [AlarmasController],
  providers: [AlarmasReceptorService, AlarmasService],
  exports: [AlarmasReceptorService, AlarmasService],
})
export class AlarmasReceptorModule {}
