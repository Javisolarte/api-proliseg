import { Module } from "@nestjs/common";
import { CotizacionesController } from "./cotizaciones.controller";
import { PublicCotizacionesController } from "./public-cotizaciones.controller";
import { CotizacionesService } from "./cotizaciones.service";
import { AuthModule } from "../auth/auth.module";
import { SupabaseModule } from "../supabase/supabase.module";

@Module({
    imports: [AuthModule, SupabaseModule],
    controllers: [CotizacionesController, PublicCotizacionesController],
    providers: [CotizacionesService],
    exports: [CotizacionesService],
})
export class CotizacionesModule { }
