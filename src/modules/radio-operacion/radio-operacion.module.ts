import { Module } from '@nestjs/common';
import { RadioOperacionController } from './radio-operacion.controller';
import { RadioOperacionService } from './radio-operacion.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [RadioOperacionController],
  providers: [RadioOperacionService],
  exports: [RadioOperacionService],
})
export class RadioOperacionModule {}
