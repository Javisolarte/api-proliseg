import { Module } from "@nestjs/common";
import { RondasEjecucionController } from "./rondas-ejecucion.controller";
import { RondasEjecucionService } from "./rondas-ejecucion.service";
import { AuthModule } from "../auth/auth.module";
import { MinutasModule } from "../minutas/minutas.module";

@Module({
    imports: [AuthModule, MinutasModule],
    controllers: [RondasEjecucionController],
    providers: [RondasEjecucionService],
    exports: [RondasEjecucionService],
})
export class RondasEjecucionModule { }
