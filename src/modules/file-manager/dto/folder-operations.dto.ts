import { IsString, IsOptional, IsHexColor, IsUUID } from 'class-validator';

export class CreateFolderDto {
    @IsString()
    nombre: string;

    @IsOptional()
    @IsUUID()
    parentId: string;

    @IsOptional()
    @IsString()
    color: string;
}

export class UpdateFolderDto {
    @IsOptional()
    @IsString()
    nombre?: string;

    @IsOptional()
    @IsString()
    color?: string;
}
