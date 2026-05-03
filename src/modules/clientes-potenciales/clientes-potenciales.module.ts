import { Module } from '@nestjs/common';
import { ClientesPotencialesController } from './clientes-potenciales.controller';
import { ClientesPotencialesService } from './clientes-potenciales.service';
import { SupabaseModule } from '../../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [ClientesPotencialesController],
  providers: [ClientesPotencialesService],
  exports: [ClientesPotencialesService]
})
export class ClientesPotencialesModule {}
