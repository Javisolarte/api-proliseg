import { Module } from '@nestjs/common';
import { ClientesConfigController } from './clientes-config.controller';
import { ClientesConfigService } from './clientes-config.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
    imports: [SupabaseModule],
    controllers: [ClientesConfigController],
    providers: [ClientesConfigService],
    exports: [ClientesConfigService],
})
export class ClientesConfigModule { }
