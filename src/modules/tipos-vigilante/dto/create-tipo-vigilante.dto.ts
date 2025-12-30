import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTipoVigilanteDto {
    @ApiProperty({
        description: 'Nombre del tipo de vigilante',
        example: 'Vigilante Armado',
    })
    @IsString()
    nombre: string;

    @ApiProperty({
        description: 'Descripción del tipo de vigilante',
        example: 'Vigilante con permiso de porte de armas',
        required: false,
    })
    @IsOptional()
    @IsString()
    descripcion?: string;

    @ApiProperty({
        description: 'Indica si el tipo de vigilante está activo',
        example: true,
        required: false,
        default: true,
    })
    @IsOptional()
    @IsBoolean()
    activo?: boolean;
}
