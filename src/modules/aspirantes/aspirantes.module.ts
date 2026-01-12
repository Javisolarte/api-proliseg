import { Module } from '@nestjs/common';
import { AspirantesService } from './aspirantes.service';
import { AspirantesController } from './aspirantes.controller';
import { SupabaseService } from '../supabase/supabase.service';
import { PublicAspirantesController } from './public-aspirantes.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [AuthModule],
    controllers: [AspirantesController, PublicAspirantesController],
    providers: [AspirantesService, SupabaseService],
    exports: [AspirantesService],
})
export class AspirantesModule { }
