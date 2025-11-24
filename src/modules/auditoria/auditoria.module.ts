import { Module } from "@nestjs/common";
import { AuditoriaController } from "./auditoria.controller";
import { AuditoriaService } from "./auditoria.service";
import { SupabaseModule } from "../supabase/supabase.module";
import { AuthModule } from "../auth/auth.module";

@Module({
    imports: [SupabaseModule, AuthModule],
    controllers: [AuditoriaController],
    providers: [AuditoriaService],
    exports: [AuditoriaService],
})
export class AuditoriaModule { }
