import { Module } from "@nestjs/common";
import { MemorandosService } from "./memorandos.service";
import { MemorandosController } from "./memorandos.controller";
import { SupabaseModule } from "../supabase/supabase.module";
import { AuthModule } from "../auth/auth.module";

@Module({
    imports: [SupabaseModule, AuthModule],
    providers: [MemorandosService],
    controllers: [MemorandosController],
    exports: [MemorandosService],
})
export class MemorandosModule { }
