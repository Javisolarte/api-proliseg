import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAspiranteDto {
    @ApiProperty({ description: 'Nombre completo del aspirante', example: 'Juan Pérez' })
    @IsString()
    @IsNotEmpty()
    nombre_completo: string;

    @ApiProperty({ description: 'Cédula del aspirante (Única)', example: '1234567890' })
    @IsString()
    @IsNotEmpty()
    cedula: string;

    @ApiProperty({ description: 'Teléfono de contacto', example: '3001234567' })
    @IsString()
    @IsNotEmpty()
    telefono: string;

    @ApiPropertyOptional({ description: 'Correo electrónico', example: 'juan.perez@email.com' })
    @IsEmail()
    @IsOptional()
    correo?: string;
}

export class UpdateAspiranteDto extends CreateAspiranteDto { }
