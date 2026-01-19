import { IsOptional, IsUUID } from 'class-validator';

export class MoveFolderDto {
    @IsOptional()
    @IsUUID()
    newParentId: string | null;
}

export class MoveFileDto {
    @IsOptional()
    @IsUUID()
    newFolderId: string | null;
}
