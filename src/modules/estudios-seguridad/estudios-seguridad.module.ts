import { Module } from "@nestjs/common";
import { EstudiosSeguridadController } from "./estudios-seguridad.controller";
import { EstudiosSeguridadService } from "./estudios-seguridad.service";
import { SupabaseModule } from "../supabase/supabase.module";
import { AuthModule } from "../auth/auth.module";

@Module({
    imports: [SupabaseModule, AuthModule],
    controllers: [EstudiosSeguridadController],
    providers: [EstudiosSeguridadService],
    exports: [EstudiosSeguridadService],
})
export class EstudiosSeguridadModule { }
