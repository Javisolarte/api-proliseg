import { Module } from '@nestjs/common';
import { FileManagerService } from './file-manager.service';
import { FileManagerController } from './file-manager.controller';
import { FmCarpeta } from './entities/fm-carpeta.entity';
import { FmArchivo } from './entities/fm-archivo.entity';
import { FmVersion } from './entities/fm-version.entity';
import { FmPermiso } from './entities/fm-permiso.entity';
import { DatabaseModule } from '../../database/database.module';

@Module({
    imports: [
        DatabaseModule, // Ensure SupabaseService is available
    ],
    controllers: [FileManagerController],
    providers: [FileManagerService],
    exports: [FileManagerService],
})
export class FileManagerModule { }
