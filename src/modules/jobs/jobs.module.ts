import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { AuthModule } from '../auth/auth.module';
import { BiRefreshJob } from './bi-refresh.job';

@Module({
    imports: [AuthModule],
    controllers: [JobsController],
    providers: [JobsService, BiRefreshJob],
    exports: [JobsService],
})
export class JobsModule { }
