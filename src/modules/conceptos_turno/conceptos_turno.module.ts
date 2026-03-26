import { Module } from '@nestjs/common';
import { ConceptosTurnoController } from './conceptos_turno.controller';
import { ConceptosTurnoService } from './conceptos_turno.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [ConceptosTurnoController],
  providers: [ConceptosTurnoService],
  exports: [ConceptosTurnoService],
})
export class ConceptosTurnoModule {}
