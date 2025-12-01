import { Module } from "@nestjs/common";
import { SalariosController } from "./salarios.controller";
import { SalariosService } from "./salarios.service";
import { SupabaseModule } from "../supabase/supabase.module";
import { AuthModule } from "../auth/auth.module";

@Module({
    imports: [SupabaseModule, AuthModule],
    controllers: [SalariosController],
    providers: [SalariosService],
    exports: [SalariosService],
})
export class SalariosModule { }
