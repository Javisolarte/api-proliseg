import { Module } from '@nestjs/common';
import { CategoriasDotacionController } from './categorias-dotacion.controller';
import { CategoriasDotacionService } from './categorias-dotacion.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [SupabaseModule, AuthModule],
    controllers: [CategoriasDotacionController],
    providers: [CategoriasDotacionService],
    exports: [CategoriasDotacionService],
})
export class CategoriasDotacionModule { }
