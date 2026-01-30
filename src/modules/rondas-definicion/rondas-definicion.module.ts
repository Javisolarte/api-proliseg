import { Module } from "@nestjs/common";
import { RondasDefinicionController } from "./rondas-definicion.controller";
import { RondasDefinicionService } from "./rondas-definicion.service";
import { AuthModule } from "../auth/auth.module";

@Module({
    imports: [AuthModule],
    controllers: [RondasDefinicionController],
    providers: [RondasDefinicionService],
    exports: [RondasDefinicionService],
})
export class RondasDefinicionModule { }
