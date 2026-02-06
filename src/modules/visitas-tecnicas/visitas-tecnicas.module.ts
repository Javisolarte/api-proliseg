import { Module } from "@nestjs/common";
import { VisitasTecnicasController } from "./visitas-tecnicas.controller";
import { VisitasTecnicasService } from "./visitas-tecnicas.service";
import { AuthModule } from "../auth/auth.module";

import { DocumentosGeneradosModule } from "../documentos-generados/documentos-generados.module";

@Module({
    imports: [AuthModule, DocumentosGeneradosModule],
    controllers: [VisitasTecnicasController],
    providers: [VisitasTecnicasService],
    exports: [VisitasTecnicasService],
})
export class VisitasTecnicasModule { }
