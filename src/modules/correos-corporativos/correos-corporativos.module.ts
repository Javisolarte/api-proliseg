import { Module } from '@nestjs/common';
import { CorreosCorporativosService } from './correos-corporativos.service';
import { CorreosCorporativosController } from './correos-corporativos.controller';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
    imports: [SupabaseModule],
    controllers: [CorreosCorporativosController],
    providers: [CorreosCorporativosService],
    exports: [CorreosCorporativosService]
})
export class CorreosCorporativosModule { }
