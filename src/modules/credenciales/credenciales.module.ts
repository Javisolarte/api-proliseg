import { Module } from '@nestjs/common';
import { CredencialesController } from './credenciales.controller';
import { CredencialesService } from './credenciales.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [CredencialesController],
  providers: [CredencialesService],
  exports: [CredencialesService]
})
export class CredencialesModule {}
