import { Module } from '@nestjs/common';
import { FacturacionController } from './facturacion.controller';
import { FacturacionService } from './facturacion.service';
import { FactusApiService } from './factus-api.service';
import { RangosController } from './rangos.controller';
import { RangosService } from './rangos.service';
import { NotasCreditoController } from './notas-credito.controller';
import { DocSoporteController } from './doc-soporte.controller';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [FacturacionController, RangosController, NotasCreditoController, DocSoporteController],
  providers: [FacturacionService, FactusApiService, RangosService],
  exports: [FacturacionService, RangosService]
})
export class FacturacionModule {}
