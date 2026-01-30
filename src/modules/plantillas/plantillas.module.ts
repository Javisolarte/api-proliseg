import { Module } from "@nestjs/common";
import { PlantillasController } from "./plantillas.controller";
import { PlantillasService } from "./plantillas.service";
import { AuthModule } from "../auth/auth.module";

@Module({
    imports: [AuthModule],
    controllers: [PlantillasController],
    providers: [PlantillasService],
    exports: [PlantillasService],
})
export class PlantillasModule { }
