import { Module } from "@nestjs/common";
import { ConsentimientosController } from "./consentimientos.controller";
import { ConsentimientosService } from "./consentimientos.service";
import { AuthModule } from "../auth/auth.module";

@Module({
    imports: [AuthModule],
    controllers: [ConsentimientosController],
    providers: [ConsentimientosService],
    exports: [ConsentimientosService],
})
export class ConsentimientosModule { }
