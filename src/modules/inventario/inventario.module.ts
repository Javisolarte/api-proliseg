import { Module } from '@nestjs/common';
import { InventarioController } from './inventario.controller';
import { InventarioService } from './inventario.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';
import { DocumentosGeneradosModule } from '../documentos-generados/documentos-generados.module';

@Module({
    imports: [SupabaseModule, AuthModule, DocumentosGeneradosModule],
    controllers: [InventarioController],
    providers: [InventarioService],
    exports: [InventarioService],
})
export class InventarioModule { }
