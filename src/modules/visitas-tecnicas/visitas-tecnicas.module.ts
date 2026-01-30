import { Module } from "@nestjs/common";
import { VisitasTecnicasController } from "./visitas-tecnicas.controller";
import { VisitasTecnicasService } from "./visitas-tecnicas.service";
import { AuthModule } from "../auth/auth.module";

@Module({
    imports: [AuthModule],
    controllers: [VisitasTecnicasController],
    providers: [VisitasTecnicasService],
    exports: [VisitasTecnicasService],
})
export class VisitasTecnicasModule { }
