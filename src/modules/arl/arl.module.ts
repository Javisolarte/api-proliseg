import { Module } from "@nestjs/common";
import { ArlController } from "./arl.controller";
import { ArlService } from "./arl.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [ArlController],
  providers: [ArlService],
  exports: [ArlService],
})
export class ArlModule {}
