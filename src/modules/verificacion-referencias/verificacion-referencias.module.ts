import { Module } from "@nestjs/common";
import { VerificacionReferenciasController } from "./verificacion-referencias.controller";
import { VerificacionReferenciasService } from "./verificacion-referencias.service";
import { AuthModule } from "../auth/auth.module";

@Module({
    imports: [AuthModule],
    controllers: [VerificacionReferenciasController],
    providers: [VerificacionReferenciasService],
    exports: [VerificacionReferenciasService],
})
export class VerificacionReferenciasModule { }
