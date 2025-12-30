import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTipoCursoVigilanciaDto {
    @ApiProperty({
        description: 'Nombre del tipo de curso de vigilancia',
        example: 'Fundamentación Vigilante',
    })
    @IsString()
    nombre: string;

    @ApiProperty({
        description: 'Descripción del tipo de curso de vigilancia',
        example: 'Curso básico de fundamentación para vigilantes',
        required: false,
    })
    @IsOptional()
    @IsString()
    descripcion?: string;

    @ApiProperty({
        description: 'Indica si el tipo de curso está activo',
        example: true,
        required: false,
        default: true,
    })
    @IsOptional()
    @IsBoolean()
    activo?: boolean;
}
