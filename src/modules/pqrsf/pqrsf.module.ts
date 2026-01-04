import { Module } from '@nestjs/common';
import { PqrsfService } from './pqrsf.service';
import { PqrsfController } from './pqrsf.controller';

import { AuthModule } from '../auth/auth.module';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
    imports: [AuthModule, SupabaseModule],
    controllers: [PqrsfController],
    providers: [PqrsfService],
    exports: [PqrsfService]
})
export class PqrsfModule { }
