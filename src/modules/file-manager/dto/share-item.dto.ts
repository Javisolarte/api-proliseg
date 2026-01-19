import { IsString, IsEnum, IsNumber, IsUUID } from 'class-validator';

export class ShareItemDto {
    @IsUUID()
    itemId: string;

    @IsString()
    @IsEnum(['file', 'folder'])
    itemType: 'file' | 'folder';

    @IsNumber()
    userId: number;

    @IsString()
    @IsEnum(['lectura', 'escritura'])
    permission: 'lectura' | 'escritura';
}
