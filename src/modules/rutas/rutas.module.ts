import { Module } from "@nestjs/common";
import { RutasController } from "./rutas.controller";
import { RutasService } from "./rutas.service";
import { SupabaseModule } from "../supabase/supabase.module";
import { AuthModule } from "../auth/auth.module";

@Module({
    imports: [SupabaseModule, AuthModule],
    controllers: [RutasController],
    providers: [RutasService],
    exports: [RutasService],
})
export class RutasModule { }
