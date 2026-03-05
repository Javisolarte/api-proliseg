import { Controller, Get, Param, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { FileManagerService } from './file-manager.service';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('File Manager (Public)')
@Controller('public/file-manager')
@Public()
export class FileManagerPublicController {
    constructor(private readonly fileManagerService: FileManagerService) { }

    @Get('files/:id/details')
    @ApiOperation({ summary: 'Obtener detalles de un archivo público' })
    async getPublicFileDetails(@Param('id') id: string) {
        return this.fileManagerService.getPublicFileDetails(id);
    }

    @Get('files/:id/download')
    @ApiOperation({ summary: 'Obtener URL de descarga de un archivo público' })
    async getPublicFileDownloadUrl(@Param('id') id: string) {
        return { url: await this.fileManagerService.getPublicDownloadUrl(id) };
    }
}
