import { Module } from "@nestjs/common";
import { VisitasPreliminareController } from "./visitas-preliminares.controller";
import { VisitasPreliminareService } from "./visitas-preliminares.service";
import { AuthModule } from "../auth/auth.module";
import { DocumentosGeneradosModule } from "../documentos-generados/documentos-generados.module";

@Module({
    imports: [AuthModule, DocumentosGeneradosModule],
    controllers: [VisitasPreliminareController],
    providers: [VisitasPreliminareService],
    exports: [VisitasPreliminareService],
})
export class VisitasPreliminareModule { }
