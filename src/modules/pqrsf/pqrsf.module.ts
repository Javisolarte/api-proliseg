import { Module } from '@nestjs/common';
import { PqrsfService } from './pqrsf.service';
import { PqrsfController } from './pqrsf.controller';

@Module({
    controllers: [PqrsfController],
    providers: [PqrsfService],
    exports: [PqrsfService]
})
export class PqrsfModule { }
