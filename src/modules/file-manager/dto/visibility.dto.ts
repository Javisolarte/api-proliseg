import { IsEnum, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateVisibilityDto {
    @ApiProperty({ enum: ['privado', 'publico'], example: 'publico' })
    @IsEnum(['privado', 'publico'])
    visibilidad: 'privado' | 'publico';
}

export class RenameFolderDto {
    @ApiProperty({ example: 'Soporte Técnico' })
    @IsString()
    @IsNotEmpty()
    nombre: string;
}
