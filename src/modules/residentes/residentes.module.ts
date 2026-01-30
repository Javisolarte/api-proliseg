import { Module } from "@nestjs/common";
import { ResidentesController } from "./residentes.controller";
import { ResidentesService } from "./residentes.service";
import { AuthModule } from "../auth/auth.module";

@Module({
    imports: [AuthModule],
    controllers: [ResidentesController],
    providers: [ResidentesService],
    exports: [ResidentesService],
})
export class ResidentesModule { }
