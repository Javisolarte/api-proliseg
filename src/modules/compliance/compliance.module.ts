import { Module, Global } from '@nestjs/common';
import { IntegrityService } from '../../common/services/integrity.service';
import { ComplianceService } from './compliance.service';
import { ComplianceController } from './compliance.controller';

@Global()
@Module({
    providers: [IntegrityService, ComplianceService],
    controllers: [ComplianceController],
    exports: [IntegrityService, ComplianceService],
})
export class ComplianceModule { }
