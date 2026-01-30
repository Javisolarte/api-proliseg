import { Module } from "@nestjs/common";
import { DocumentosGeneradosController } from "./documentos-generados.controller";
import { DocumentosGeneradosService } from "./documentos-generados.service";
import { AuthModule } from "../auth/auth.module";

import { PlantillasModule } from "../plantillas/plantillas.module";

@Module({
    imports: [AuthModule, PlantillasModule],
    controllers: [DocumentosGeneradosController],
    providers: [DocumentosGeneradosService],
    exports: [DocumentosGeneradosService],
})
export class DocumentosGeneradosModule { }
