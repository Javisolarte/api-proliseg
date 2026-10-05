import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { ControlAccesoModule } from '../control-acceso/control-acceso.module';
import { AuthModule } from '../auth/auth.module';
import { AsistenciaIotController } from './asistencia-iot.controller';
import { AsistenciaIotService } from './asistencia-iot.service';

@Module({
  imports: [SupabaseModule, ControlAccesoModule, AuthModule],
  controllers: [AsistenciaIotController],
  providers: [AsistenciaIotService],
  exports: [AsistenciaIotService],
})
export class AsistenciaIotModule {}
