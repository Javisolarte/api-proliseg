import { Module } from "@nestjs/common";
import { InventarioPuestoController } from "./inventario-puesto.controller";
import { InventarioPuestoService } from "./inventario-puesto.service";
import { AuthModule } from "../auth/auth.module";

@Module({
    imports: [AuthModule],
    controllers: [InventarioPuestoController],
    providers: [InventarioPuestoService],
    exports: [InventarioPuestoService],
})
export class InventarioPuestoModule { }
