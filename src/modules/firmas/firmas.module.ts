import { forwardRef, Module } from "@nestjs/common";
import { FirmasController } from "./firmas.controller";
import { FirmasService } from "./firmas.service";
import { AuthModule } from "../auth/auth.module";

import { DocumentosGeneradosModule } from "../documentos-generados/documentos-generados.module";

@Module({
    imports: [AuthModule, forwardRef(() => DocumentosGeneradosModule)],
    controllers: [FirmasController],
    providers: [FirmasService],
    exports: [FirmasService],
})
export class FirmasModule { }
