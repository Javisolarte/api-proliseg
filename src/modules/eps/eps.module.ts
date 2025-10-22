import { Module } from "@nestjs/common";
import { EpsController } from "./eps.controller";
import { EpsService } from "./eps.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [EpsController],
  providers: [EpsService],
  exports: [EpsService],
})
export class EpsModule {}
