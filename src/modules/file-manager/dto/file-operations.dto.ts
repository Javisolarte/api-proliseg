import { IsString, IsOptional } from 'class-validator';

export class RenameFileDto {
    @IsString()
    nombre: string;
}

export class CreateVersionDto {
    @IsOptional()
    @IsString()
    comentarioCambio?: string;
}
