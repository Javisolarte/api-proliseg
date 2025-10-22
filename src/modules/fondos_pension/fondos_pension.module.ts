import { Module } from "@nestjs/common";
import { FondosPensionController } from "./fondos_pension.controller";
import { FondosPensionService } from "./fondos_pension.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [FondosPensionController],
  providers: [FondosPensionService],
  exports: [FondosPensionService],
})
export class FondosPensionModule {}
