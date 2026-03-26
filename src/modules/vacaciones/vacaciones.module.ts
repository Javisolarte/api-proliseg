import { Module } from '@nestjs/common';
import { VacacionesController } from './vacaciones.controller';
import { VacacionesService } from './vacaciones.service';
import { SupabaseModule } from '../supabase/supabase.module'; 

@Module({
  imports: [SupabaseModule],
  controllers: [VacacionesController],
  providers: [VacacionesService],
  exports: [VacacionesService],
})
export class VacacionesModule {}
