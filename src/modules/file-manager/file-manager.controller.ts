import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseInterceptors, UploadedFile, UseGuards, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody, ApiQuery, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { FileManagerService } from './file-manager.service';
import { CreateFolderDto, UpdateFolderDto } from './dto/folder-operations.dto';
import { MoveFolderDto, MoveFileDto } from './dto/move-item.dto';
import { ShareItemDto } from './dto/share-item.dto';
import { CreateVersionDto, RenameFileDto } from './dto/file-operations.dto';
import { UpdateVisibilityDto, RenameFolderDto } from './dto/visibility.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

@ApiTags('File Manager')
@ApiBearerAuth()
@Controller('file-manager')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FileManagerController {
    constructor(private readonly fileManagerService: FileManagerService) { }

    // --- A. Navegación y Contenido ---

    @Get('content')
    @ApiOperation({ summary: 'Obtener contenido de una carpeta (o raíz)', description: 'Devuelve carpetas y archivos visibles para el usuario en la ubicación especificada.' })
    @ApiQuery({ name: 'folderId', required: false, description: 'ID de la carpeta. Usar "root" o dejar vacío para la raíz.' })
    @ApiQuery({ name: 'sort', required: false, enum: ['name', 'date'], description: 'Campo por el cual ordenar.' })
    @ApiQuery({ name: 'order', required: false, enum: ['ASC', 'DESC'], description: 'Dirección del ordenamiento.' })
    @ApiResponse({ status: 200, description: 'Lista de carpetas y archivos.' })
    async getContent(
        @CurrentUser() user: any,
        @Query('folderId') folderId?: string,
        @Query('sort') sort?: string,
        @Query('order') order: 'ASC' | 'DESC' = 'ASC',
    ) {
        const targetFolderId = folderId === 'root' ? null : (folderId || null);
        return this.fileManagerService.getContent(user.id, targetFolderId, sort, order);
    }

    @Get('breadcrumbs/:folderId')
    @ApiOperation({ summary: 'Obtener migas de pan (ruta)', description: 'Devuelve la jerarquía de carpetas padres desde la raíz hasta la carpeta actual.' })
    @ApiParam({ name: 'folderId', description: 'ID de la carpeta actual' })
    async getBreadcrumbs(@Param('folderId') folderId: string) {
        return this.fileManagerService.getBreadcrumbs(folderId);
    }

    @Get('search')
    @ApiOperation({ summary: 'Buscador global', description: 'Busca archivos y carpetas por nombre en todo el sistema accesible por el usuario.' })
    @ApiQuery({ name: 'query', description: 'Texto a buscar' })
    async search(@CurrentUser() user: any, @Query('query') query: string) {
        return this.fileManagerService.search(user.id, query);
    }

    // --- B. Gestión de Carpetas ---

    @Post('folders')
    @ApiOperation({ summary: 'Crear una carpeta' })
    @ApiResponse({ status: 201, description: 'Carpeta creada exitosamente.' })
    async createFolder(@CurrentUser() user: any, @Body() dto: CreateFolderDto) {
        return this.fileManagerService.createFolder(user.id, dto);
    }

    @Patch('folders/:id')
    @ApiOperation({ summary: 'Editar metadatos de una carpeta', description: 'Permite cambiar el nombre o el color de la carpeta.' })
    async updateFolder(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateFolderDto) {
        return this.fileManagerService.updateFolder(user.id, id, dto);
    }

    @Patch('folders/:id/rename')
    @ApiOperation({ summary: 'Renombrar una carpeta', description: 'Endpoint específico para cambiar el nombre de una carpeta.' })
    async renameFolder(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: RenameFolderDto) {
        return this.fileManagerService.renameFolder(user.id, id, dto);
    }

    @Patch('move/folder/:id')
    @ApiOperation({ summary: 'Mover una carpeta (Drag & Drop)', description: 'Cambia el parentId de la carpeta.' })
    async moveFolder(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: MoveFolderDto) {
        return this.fileManagerService.moveFolder(user.id, id, dto);
    }

    @Delete('folders/:id')
    @ApiOperation({ summary: 'Eliminar carpeta (Soft Delete)' })
    async deleteFolder(@CurrentUser() user: any, @Param('id') id: string) {
        return this.fileManagerService.deleteFolder(user.id, id);
    }

    // --- C. Gestión de Archivos ---

    @Post('files/upload')
    @ApiOperation({ summary: 'Subir un archivo inicial', description: 'Sube un archivo a Supabase y registra sus metadatos y la versión 1.' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: { type: 'string', format: 'binary' },
                carpetaId: { type: 'string', description: 'ID de la carpeta destino (opcional)' },
            },
        },
    })
    @UseInterceptors(FileInterceptor('file'))
    async uploadFile(
        @CurrentUser() user: any,
        @UploadedFile() file: any,
        @Body('carpetaId') carpetaId?: string
    ) {
        return this.fileManagerService.uploadFile(user.id, file, carpetaId || null);
    }

    @Get('files/:id/details')
    @ApiOperation({ summary: 'Obtener detalles de un archivo', description: 'Retorna metadatos completos y lista de versiones.' })
    async getFileDetails(@CurrentUser() user: any, @Param('id') id: string) {
        return this.fileManagerService.getFileDetails(user.id, id);
    }

    @Get('files/:id/summary')
    @ApiOperation({ summary: 'Obtener información ligera para cards', description: 'Evita pedir detalles completos; ideal para vistas de lista o cuadrícula.' })
    async getFileSummary(@CurrentUser() user: any, @Param('id') id: string) {
        return this.fileManagerService.getFileSummary(user.id, id);
    }

    @Get('files/:id/permissions')
    @ApiOperation({ summary: 'Obtener permisos de un usuario sobre un archivo', description: 'Determina si el usuario puede leer, escribir o es el propietario.' })
    async getPermissions(@CurrentUser() user: any, @Param('id') id: string) {
        return this.fileManagerService.getPermissions(user.id, id);
    }

    @Patch('files/:id/rename')
    @ApiOperation({ summary: 'Renombrar un archivo' })
    async renameFile(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: RenameFileDto) {
        return this.fileManagerService.renameFile(user.id, id, dto);
    }

    @Patch('files/:id/visibility')
    @ApiOperation({ summary: 'Cambiar visibilidad (privado / público)', description: 'Permite hacer un archivo accesible mediante URL pública o restringirlo.' })
    async updateVisibility(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateVisibilityDto) {
        return this.fileManagerService.updateVisibility(user.id, id, dto);
    }

    @Patch('move/file/:id')
    @ApiOperation({ summary: 'Mover un archivo (Drag & Drop)' })
    async moveFile(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: MoveFileDto) {
        return this.fileManagerService.moveFile(user.id, id, dto);
    }

    @Delete('files/:id')
    @ApiOperation({ summary: 'Eliminar archivo (Soft Delete)' })
    async deleteFile(@CurrentUser() user: any, @Param('id') id: string) {
        return this.fileManagerService.deleteFile(user.id, id);
    }

    @Get('files/:id/download')
    @ApiOperation({ summary: 'Descargar versión actual', description: 'Resuelve la versión activa y devuelve un Signed URL temporal.' })
    async getLatestDownloadUrl(@Param('id') id: string) {
        return { url: await this.fileManagerService.getLatestDownloadUrl(id) };
    }

    @Get('files/:id/preview')
    @ApiOperation({ summary: 'Vista rápida / preview', description: 'Genera un Signed URL de corta duración para previsualización (PDF, Imágenes).' })
    async getPreviewUrl(@Param('id') id: string) {
        // For signed URLs, the result is the same as download
        return { url: await this.fileManagerService.getLatestDownloadUrl(id) };
    }

    // --- D. Versionamiento ---

    @Post('files/:id/versions')
    @ApiOperation({ summary: 'Subir una nueva versión de un archivo' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: { type: 'string', format: 'binary' },
                comentarioCambio: { type: 'string' },
            },
        },
    })
    @UseInterceptors(FileInterceptor('file'))
    async newVersion(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @UploadedFile() file: any,
        @Body() dto: CreateVersionDto
    ) {
        return this.fileManagerService.newVersion(user.id, id, file, dto);
    }

    @Get('files/:id/versions')
    @ApiOperation({ summary: 'Listar histórico de versiones de un archivo' })
    async getVersions(@CurrentUser() user: any, @Param('id') id: string) {
        return this.fileManagerService.getVersions(user.id, id);
    }

    @Get('versions/:versionId/download')
    @ApiOperation({ summary: 'Descargar versión específica' })
    async getDownloadUrl(@Param('versionId') versionId: string) {
        return { url: await this.fileManagerService.getDownloadUrl(versionId) };
    }

    // --- E. Compartir ---

    @Post('share')
    @ApiOperation({ summary: 'Compartir un elemento' })
    async shareItem(@CurrentUser() user: any, @Body() dto: ShareItemDto) {
        return this.fileManagerService.shareItem(user.id, dto);
    }

    @Delete('share/:permisoId')
    @ApiOperation({ summary: 'Revocar un permiso compartido' })
    async revokeShare(@CurrentUser() user: any, @Param('permisoId') permisoId: number) {
        return this.fileManagerService.revokeShare(user.id, permisoId);
    }

    @Get('shared-with-me')
    @ApiOperation({ summary: 'Listar elementos compartidos conmigo' })
    async getSharedWithMe(@CurrentUser() user: any) {
        return this.fileManagerService.getSharedWithMe(user.id);
    }

    // --- F. Papelera & Stats ---

    @Get('trash')
    @ApiOperation({ summary: 'Ver papelera' })
    async getTrash(@CurrentUser() user: any) {
        return this.fileManagerService.getTrash(user.id);
    }

    @Delete('trash')
    @ApiOperation({ summary: 'Vaciar papelera', description: 'Elimina permanentemente todos los elementos del usuario en la papelera.' })
    async purgeTrash(@CurrentUser() user: any) {
        return this.fileManagerService.purgeTrash(user.id);
    }

    @Post('trash/:itemId/restore')
    @ApiOperation({ summary: 'Restaurar elemento' })
    async restoreItem(@CurrentUser() user: any, @Param('itemId') itemId: string, @Body('type') type: 'file' | 'folder') {
        if (!type) throw new BadRequestException("El tipo (file/folder) es requerido");
        return this.fileManagerService.restoreItem(user.id, itemId, type);
    }

    @Get('dashboard/stats')
    @ApiOperation({ summary: 'Estadísticas del sistema' })
    async getStats(@CurrentUser() user: any) {
        return this.fileManagerService.getStats(user.id);
    }
}
