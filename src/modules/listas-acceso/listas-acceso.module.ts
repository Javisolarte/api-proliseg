import { Module } from "@nestjs/common";
import { ListasAccesoController } from "./listas-acceso.controller";
import { ListasAccesoService } from "./listas-acceso.service";
import { AuthModule } from "../auth/auth.module";

import { ImportModule } from "../../common/services/import.module";

@Module({
    imports: [AuthModule, ImportModule],
    controllers: [ListasAccesoController],
    providers: [ListasAccesoService],
    exports: [ListasAccesoService],
})
export class ListasAccesoModule { }
