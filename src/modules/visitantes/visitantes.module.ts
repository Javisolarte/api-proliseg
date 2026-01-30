import { Module } from "@nestjs/common";
import { VisitantesController } from "./visitantes.controller";
import { VisitantesService } from "./visitantes.service";
import { AuthModule } from "../auth/auth.module";

@Module({
    imports: [AuthModule],
    controllers: [VisitantesController],
    providers: [VisitantesService],
    exports: [VisitantesService],
})
export class VisitantesModule { }
