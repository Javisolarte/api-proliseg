import { Module } from '@nestjs/common';
import { AsignarTurnosController } from './asignar_turnos.controller';
import { AsignarTurnosService } from './asignar_turnos.service';
import { AsignarTurnosScheduler } from './asignar_turnos.scheduler';
import { AuthModule } from '../auth/auth.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { TurnosHelperService } from '../../common/helpers/turnos-helper.service';

@Module({
  imports: [
    AuthModule,
    SupabaseModule,
  ],
  controllers: [AsignarTurnosController],
  providers: [AsignarTurnosService, AsignarTurnosScheduler, TurnosHelperService],
  exports: [AsignarTurnosService],
})
export class AsignarTurnosModule { }
