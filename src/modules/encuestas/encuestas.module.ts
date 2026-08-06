import { Module } from '@nestjs/common';
import { EncuestasController } from './encuestas.controller';
import { EncuestasService } from './encuestas.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [EncuestasController],
  providers: [EncuestasService],
  exports: [EncuestasService]
})
export class EncuestasModule {}
