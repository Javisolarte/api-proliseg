import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCategoriaDotacionDto {
    @ApiProperty({ description: 'Nombre de la categoría', example: 'Uniformes' })
    @IsString()
    @IsNotEmpty()
    nombre: string;

    @ApiProperty({ description: 'Descripción de la categoría', example: 'Ropa de trabajo para guardas', required: false })
    @IsString()
    @IsOptional()
    descripcion?: string;
}

export class UpdateCategoriaDotacionDto {
    @ApiProperty({ description: 'Nombre de la categoría', example: 'Uniformes', required: false })
    @IsString()
    @IsOptional()
    nombre?: string;

    @ApiProperty({ description: 'Descripción de la categoría', example: 'Ropa de trabajo para guardas', required: false })
    @IsString()
    @IsOptional()
    descripcion?: string;
}
