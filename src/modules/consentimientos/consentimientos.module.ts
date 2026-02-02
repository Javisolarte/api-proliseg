import { Module } from "@nestjs/common";
import { ConsentimientosController } from "./consentimientos.controller";
import { ConsentimientosService } from "./consentimientos.service";
import { AuthModule } from "../auth/auth.module";

import { DocumentosGeneradosModule } from "../documentos-generados/documentos-generados.module";

@Module({
    imports: [AuthModule, DocumentosGeneradosModule],
    controllers: [ConsentimientosController],
    providers: [ConsentimientosService],
    exports: [ConsentimientosService],
})
export class ConsentimientosModule { }
