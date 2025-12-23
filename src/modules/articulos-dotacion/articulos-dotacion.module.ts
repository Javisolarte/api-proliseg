import { Module } from '@nestjs/common';
import { ArticulosDotacionController } from './articulos-dotacion.controller';
import { ArticulosDotacionService } from './articulos-dotacion.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [SupabaseModule, AuthModule],
    controllers: [ArticulosDotacionController],
    providers: [ArticulosDotacionService],
    exports: [ArticulosDotacionService],
})
export class ArticulosDotacionModule { }
