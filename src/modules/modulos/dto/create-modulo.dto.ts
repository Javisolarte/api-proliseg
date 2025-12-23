import { IsNotEmpty, IsOptional, IsString, IsNumber } from 'class-validator';

export class CreateModuloDto {
    @IsNotEmpty()
    @IsString()
    nombre: string;

    @IsOptional()
    @IsString()
    descripcion?: string;

    @IsOptional()
    @IsString()
    categoria?: string;

    @IsOptional()
    @IsNumber()
    parent_id?: number;
}
