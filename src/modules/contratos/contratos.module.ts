import { Module } from '@nestjs/common';
import { ContratosService } from './contratos.service';
import { ContratosController } from './contratos.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';
import { RlsHelperService } from '../../common/services/rls-helper.service';

@Module({
  imports: [SupabaseModule, AuthModule],
  controllers: [ContratosController],
  providers: [ContratosService, RlsHelperService],
  exports: [ContratosService],
})
export class ContratosModule { }
