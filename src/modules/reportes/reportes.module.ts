import { Module } from "@nestjs/common";
import { ReportesController } from "./reportes.controller";
import { ReportesService } from "./reportes.service";
import { SupabaseModule } from "../supabase/supabase.module";
import { AuthModule } from "../auth/auth.module";

@Module({
    imports: [SupabaseModule, AuthModule],
    controllers: [ReportesController],
    providers: [ReportesService],
    exports: [ReportesService],
})
export class ReportesModule { }
