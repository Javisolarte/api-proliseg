import { Module } from "@nestjs/common";
import { VisitasRegistroController } from "./visitas-registro.controller";
import { VisitasRegistroService } from "./visitas-registro.service";
import { AuthModule } from "../auth/auth.module";

import { ListasAccesoModule } from "../listas-acceso/listas-acceso.module";

@Module({
    imports: [AuthModule, ListasAccesoModule],
    controllers: [VisitasRegistroController],
    providers: [VisitasRegistroService],
    exports: [VisitasRegistroService],
})
export class VisitasRegistroModule { }
