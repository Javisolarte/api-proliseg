import { Module } from '@nestjs/common';
import { TiposCursoVigilanciaService } from './tipos-curso-vigilancia.service';
import { TiposCursoVigilanciaController } from './tipos-curso-vigilancia.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [SupabaseModule, AuthModule],
    controllers: [TiposCursoVigilanciaController],
    providers: [TiposCursoVigilanciaService],
    exports: [TiposCursoVigilanciaService],
})
export class TiposCursoVigilanciaModule { }
