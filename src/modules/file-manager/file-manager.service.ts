import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateFolderDto, UpdateFolderDto } from './dto/folder-operations.dto';
import { MoveFolderDto, MoveFileDto } from './dto/move-item.dto';
import { ShareItemDto } from './dto/share-item.dto';
import { CreateVersionDto, RenameFileDto } from './dto/file-operations.dto';
import { UpdateVisibilityDto, RenameFolderDto } from './dto/visibility.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class FileManagerService {
    private readonly logger = new Logger(FileManagerService.name);
    private readonly BUCKET_NAME = 'file-manager';

    constructor(
        private supabaseService: SupabaseService,
    ) { }

    private getDb() {
        return this.supabaseService.getClient();
    }

    private async execQuery(query: string) {
        const { data, error } = await this.getDb().rpc('exec_sql', { query });
        if (error) {
            this.logger.error(`Error executing SQL: ${error.message} \nQuery: ${query}`);
            throw error;
        }
        return data;
    }

    // --- A. Navegación y Contenido ---

    async getContent(userId: number, folderId?: string | null, sort: string = 'name', order: 'ASC' | 'DESC' = 'ASC') {
        const folderCondition = folderId ? `parent_id = '${folderId}'` : `parent_id IS NULL`;
        const fileCondition = folderId ? `carpeta_id = '${folderId}'` : `carpeta_id IS NULL`;

        const folderSql = `
            SELECT * FROM fm_carpetas f
            WHERE f.eliminado = false 
            AND ${folderCondition}
            AND (
                f.propietario_id = ${userId}
                OR f.id IN (SELECT carpeta_id FROM fm_permisos WHERE usuario_destino_id = ${userId})
            )
            ORDER BY ${sort === 'name' ? 'nombre' : 'updated_at'} ${order}
        `;
        const folders = await this.execQuery(folderSql);

        const fileSql = `
            SELECT a.*, v.file_path, v.version as version_actual
            FROM fm_archivos a
            LEFT JOIN fm_versiones v ON a.id = v.archivo_id AND v.id = (
                SELECT id FROM fm_versiones WHERE archivo_id = a.id ORDER BY version DESC LIMIT 1
            )
            WHERE a.eliminado = false 
            AND ${fileCondition}
            AND (
                a.propietario_id = ${userId}
                OR a.visibilidad = 'publico'
                OR a.id IN (SELECT archivo_id FROM fm_permisos WHERE usuario_destino_id = ${userId})
                ${folderId ? `OR a.carpeta_id IN (SELECT carpeta_id FROM fm_permisos WHERE usuario_destino_id = ${userId})` : ''}
            )
            ORDER BY ${sort === 'name' ? 'nombre_archivo' : 'updated_at'} ${order}
        `;
        const files = await this.execQuery(fileSql);

        return { folders: folders || [], files: files || [] };
    }

    async getBreadcrumbs(folderId: string | null) {
        if (!folderId) return [];
        const crumbs: any[] = [];
        let currentId = folderId;

        for (let i = 0; i < 10; i++) {
            const { data: folder } = await this.getDb().from('fm_carpetas').select('id, nombre, parent_id').eq('id', currentId).maybeSingle();
            if (!folder) break;
            crumbs.unshift(folder);
            if (!folder.parent_id) break;
            currentId = folder.parent_id;
        }
        return crumbs;
    }

    async search(userId: number, query: string) {
        const folders = await this.getDb().from('fm_carpetas').select('*').ilike('nombre', `%${query}%`).eq('propietario_id', userId).eq('eliminado', false).limit(20);
        const files = await this.getDb().from('fm_archivos').select('*').ilike('nombre_archivo', `%${query}%`).eq('propietario_id', userId).eq('eliminado', false).limit(20);
        return { folders: folders.data || [], files: files.data || [] };
    }

    // --- B. Gestión de Carpetas ---

    async createFolder(userId: number, dto: CreateFolderDto) {
        const { data, error } = await this.getDb().from('fm_carpetas').insert({
            nombre: dto.nombre,
            parent_id: dto.parentId || null,
            propietario_id: userId,
            color: dto.color || '#3b82f6',
        }).select().single();
        if (error) throw error;
        return data;
    }

    async updateFolder(userId: number, id: string, dto: UpdateFolderDto) {
        const { data, error } = await this.getDb().from('fm_carpetas').update({
            nombre: dto.nombre,
            color: dto.color,
            updated_at: new Date().toISOString()
        }).eq('id', id).eq('propietario_id', userId).select().single();
        if (error) throw error;
        return data;
    }

    async moveFolder(userId: number, id: string, dto: MoveFolderDto) {
        const { data, error } = await this.getDb().from('fm_carpetas').update({
            parent_id: dto.newParentId || null,
            updated_at: new Date().toISOString()
        }).eq('id', id).eq('propietario_id', userId).select().single();
        if (error) throw error;
        return data;
    }

    async deleteFolder(userId: number, id: string) {
        const { data, error } = await this.getDb().from('fm_carpetas').update({
            eliminado: true,
            updated_at: new Date().toISOString()
        }).eq('id', id).eq('propietario_id', userId).select().single();
        if (error) throw error;
        return data;
    }

    async renameFolder(userId: number, id: string, dto: RenameFolderDto) {
        const { data, error } = await this.getDb().from('fm_carpetas').update({
            nombre: dto.nombre,
            updated_at: new Date().toISOString()
        }).eq('id', id).eq('propietario_id', userId).select().single();
        if (error) throw error;
        return data;
    }

    // --- C. Gestión de Archivos ---

    async uploadFile(userId: number, file: any, carpetaId: string | null) {
        const archivoId = randomUUID();
        const versionNum = 1;
        const extension = file.originalname.split('.').pop();
        const storagePath = `${userId}/${archivoId}/${versionNum}_${file.originalname}`;

        try {
            await this.supabaseService.uploadFile(this.BUCKET_NAME, storagePath, file.buffer, file.mimetype);
            const { data: archivo, error: archError } = await this.getDb().from('fm_archivos').insert({
                id: archivoId,
                nombre_archivo: file.originalname,
                extension,
                tipo_mime: file.mimetype,
                tamano: file.size,
                carpeta_id: carpetaId || null,
                propietario_id: userId,
                visibilidad: 'privado',
            }).select().single();

            if (archError) throw archError;

            await this.getDb().from('fm_versiones').insert({
                archivo_id: archivo.id,
                version: versionNum,
                file_path: storagePath,
                tamano: file.size,
                creado_por: userId,
            });

            return archivo;
        } catch (error) {
            await this.supabaseService.deleteFile(this.BUCKET_NAME, storagePath).catch(() => { });
            throw error;
        }
    }

    async getFileDetails(userId: number, id: string) {
        const { data: file, error: fError } = await this.getDb().from('fm_archivos').select('*, fm_versiones(*)').eq('id', id).single();
        if (fError || !file) throw new NotFoundException('Archivo no encontrado');

        if (file.propietario_id !== userId && file.visibilidad !== 'publico') {
            const { data: perm } = await this.getDb().from('fm_permisos').select('id').eq('archivo_id', id).eq('usuario_destino_id', userId).maybeSingle();
            if (!perm) throw new ForbiddenException('No tienes permiso para ver este archivo');
        }

        return file;
    }

    async renameFile(userId: number, id: string, dto: RenameFileDto) {
        const { data, error } = await this.getDb().from('fm_archivos').update({
            nombre_archivo: dto.nombre,
            updated_at: new Date().toISOString()
        }).eq('id', id).eq('propietario_id', userId).select().single();
        if (error) throw error;
        return data;
    }

    async moveFile(userId: number, id: string, dto: MoveFileDto) {
        const { data, error } = await this.getDb().from('fm_archivos').update({
            carpeta_id: dto.newFolderId || null,
            updated_at: new Date().toISOString()
        }).eq('id', id).eq('propietario_id', userId).select().single();
        if (error) throw error;
        return data;
    }

    async deleteFile(userId: number, id: string) {
        const { data, error } = await this.getDb().from('fm_archivos').update({
            eliminado: true,
            updated_at: new Date().toISOString()
        }).eq('id', id).eq('propietario_id', userId).select().single();
        if (error) throw error;
        return data;
    }

    async updateVisibility(userId: number, id: string, dto: UpdateVisibilityDto) {
        const { data, error } = await this.getDb().from('fm_archivos').update({
            visibilidad: dto.visibilidad,
            updated_at: new Date().toISOString()
        }).eq('id', id).eq('propietario_id', userId).select().single();
        if (error) throw error;
        return data;
    }

    async getPermissions(userId: number, fileId: string) {
        const { data: file, error } = await this.getDb().from('fm_archivos').select('propietario_id, visibilidad').eq('id', fileId).single();
        if (error || !file) throw new NotFoundException('Archivo no encontrado');

        const isOwner = file.propietario_id === userId;
        const { data: perm } = await this.getDb().from('fm_permisos').select('permiso').eq('archivo_id', fileId).eq('usuario_destino_id', userId).maybeSingle();

        return {
            canRead: isOwner || file.visibilidad === 'publico' || !!perm,
            canWrite: isOwner || perm?.permiso === 'escritura',
            isOwner: isOwner
        };
    }

    async getFileSummary(userId: number, id: string) {
        const { data: file, error } = await this.getDb().from('fm_archivos').select('nombre_archivo, extension, tamano, visibilidad, propietario_id').eq('id', id).single();
        if (error || !file) throw new NotFoundException('Archivo no encontrado');

        // Basic check for summary
        if (file.propietario_id !== userId && file.visibilidad !== 'publico') {
            const { data: perm } = await this.getDb().from('fm_permisos').select('id').eq('archivo_id', id).eq('usuario_destino_id', userId).maybeSingle();
            if (!perm) throw new ForbiddenException('No tienes permiso para ver este archivo');
        }

        return file;
    }

    async getLatestDownloadUrl(fileId: string) {
        const { data: version, error } = await this.getDb().from('fm_versiones').select('file_path').eq('archivo_id', fileId).order('version', { ascending: false }).limit(1).single();
        if (error || !version) throw new NotFoundException('Archivo no tiene versiones');
        return this.supabaseService.getSignedUrl(this.BUCKET_NAME, version.file_path);
    }

    // --- D. Versionamiento ---

    async newVersion(userId: number, id: string, file: any, dto: CreateVersionDto) {
        const { data: lastVer } = await this.getDb().from('fm_versiones').select('version').eq('archivo_id', id).order('version', { ascending: false }).limit(1).single();
        const newVerNum = (lastVer?.version || 0) + 1;
        const storagePath = `${userId}/${id}/${newVerNum}_${file.originalname}`;

        try {
            await this.supabaseService.uploadFile(this.BUCKET_NAME, storagePath, file.buffer, file.mimetype);
            const { data, error } = await this.getDb().from('fm_versiones').insert({
                archivo_id: id,
                version: newVerNum,
                file_path: storagePath,
                tamano: file.size,
                creado_por: userId,
                comentario_cambio: dto.comentarioCambio
            }).select().single();

            if (error) throw error;
            return data;
        } catch (error) {
            await this.supabaseService.deleteFile(this.BUCKET_NAME, storagePath).catch(() => { });
            throw error;
        }
    }

    async getVersions(userId: number, id: string) {
        const { data, error } = await this.getDb().from('fm_versiones').select('*').eq('archivo_id', id).order('version', { ascending: false });
        if (error) throw error;
        return data;
    }

    async getDownloadUrl(versionId: string) {
        const { data: version, error } = await this.getDb().from('fm_versiones').select('file_path').eq('id', versionId).single();
        if (error || !version) throw new NotFoundException('Versión no encontrada');
        return this.supabaseService.getSignedUrl(this.BUCKET_NAME, version.file_path);
    }

    // --- E. Compartir ---

    async shareItem(userId: number, dto: ShareItemDto) {
        const insertData: any = {
            tipo_item: dto.itemType === 'file' ? 'archivo' : 'carpeta',
            usuario_destino_id: dto.userId,
            permiso: dto.permission,
            creado_por: userId,
        };
        if (dto.itemType === 'folder') insertData.carpeta_id = dto.itemId;
        else insertData.archivo_id = dto.itemId;

        const { data, error } = await this.getDb().from('fm_permisos').insert(insertData).select().single();
        if (error) throw error;

        if (dto.permission === 'lectura' && dto.itemType === 'file' && !dto.userId) {
            await this.getDb().from('fm_archivos').update({ visibilidad: 'publico' }).eq('id', dto.itemId);
        }
        return data;
    }

    async revokeShare(userId: number, permisoId: number) {
        const { error } = await this.getDb().from('fm_permisos').delete().eq('id', permisoId).eq('creado_por', userId);
        if (error) throw error;
        return { success: true };
    }

    async getSharedWithMe(userId: number) {
        const { data: perms } = await this.getDb().from('fm_permisos').select(`
            *,
            fm_archivos(*),
            fm_carpetas(*)
        `).eq('usuario_destino_id', userId);
        return perms || [];
    }

    // --- F. Papelera & Stats ---

    async getTrash(userId: number) {
        const { data: folders } = await this.getDb().from('fm_carpetas').select('*').eq('propietario_id', userId).eq('eliminado', true);
        const { data: files } = await this.getDb().from('fm_archivos').select('*').eq('propietario_id', userId).eq('eliminado', true);
        return { folders: folders || [], files: files || [] };
    }

    async restoreItem(userId: number, id: string, tipo: 'file' | 'folder') {
        const table = tipo === 'file' ? 'fm_archivos' : 'fm_carpetas';
        const { data, error } = await this.getDb().from(table).update({
            eliminado: false,
            updated_at: new Date().toISOString()
        }).eq('id', id).eq('propietario_id', userId).select().single();
        if (error) throw error;
        return data;
    }

    async purgeTrash(userId: number) {
        // Typically we would delete from Storage too... 
        // For brevity, we just hard delete records
        await this.getDb().from('fm_carpetas').delete().eq('propietario_id', userId).eq('eliminado', true);
        await this.getDb().from('fm_archivos').delete().eq('propietario_id', userId).eq('eliminado', true);
        return { success: true };
    }

    async getStats(userId: number) {
        const { data: total } = await this.getDb().rpc('exec_sql', {
            query: `SELECT SUM(tamano) as total FROM fm_versiones v JOIN fm_archivos a ON v.archivo_id = a.id WHERE a.propietario_id = ${userId}`
        });
        const { data: byType } = await this.getDb().rpc('exec_sql', {
            query: `SELECT extension, COUNT(*) as count, SUM(tamano) as size FROM fm_archivos WHERE propietario_id = ${userId} GROUP BY extension`
        });
        return {
            totalSize: (total as any)?.[0]?.total || 0,
            fileCount: (byType as any)?.reduce((acc, curr) => acc + Number(curr.count), 0) || 0,
            typeBreakdown: byType || []
        };
    }
}
