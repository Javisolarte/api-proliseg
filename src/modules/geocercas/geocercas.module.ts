import { Module } from "@nestjs/common";
import { GeocercasController } from "./geocercas.controller";
import { GeocercasService } from "./geocercas.service";
import { SupabaseModule } from "../supabase/supabase.module";
import { AuthModule } from "../auth/auth.module";

@Module({
    imports: [SupabaseModule, AuthModule],
    controllers: [GeocercasController],
    providers: [GeocercasService],
    exports: [GeocercasService],
})
export class GeocercasModule { }
