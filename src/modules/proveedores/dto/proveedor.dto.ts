import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProveedorDto {
    @ApiProperty({ description: 'Nombre del proveedor', example: 'Dotaciones SAS' })
    @IsString()
    @IsNotEmpty()
    nombre: string;

    @ApiProperty({ description: 'NIT del proveedor', example: '900123456-1', required: false })
    @IsString()
    @IsOptional()
    nit?: string;

    @ApiProperty({ description: 'Teléfono de contacto', example: '3001234567', required: false })
    @IsString()
    @IsOptional()
    telefono?: string;

    @ApiProperty({ description: 'Correo electrónico', example: 'ventas@dotaciones.com', required: false })
    @IsEmail()
    @IsOptional()
    correo?: string;

    @ApiProperty({ description: 'Dirección física', example: 'Calle 10 # 5-20', required: false })
    @IsString()
    @IsOptional()
    direccion?: string;
}

export class UpdateProveedorDto {
    @ApiProperty({ description: 'Nombre del proveedor', required: false })
    @IsString()
    @IsOptional()
    nombre?: string;

    @ApiProperty({ description: 'NIT', required: false })
    @IsString()
    @IsOptional()
    nit?: string;

    @ApiProperty({ description: 'Teléfono', required: false })
    @IsString()
    @IsOptional()
    telefono?: string;

    @ApiProperty({ description: 'Correo', required: false })
    @IsEmail()
    @IsOptional()
    correo?: string;

    @ApiProperty({ description: 'Dirección', required: false })
    @IsString()
    @IsOptional()
    direccion?: string;

    @ApiProperty({ description: 'Activo', required: false })
    @IsBoolean()
    @IsOptional()
    activo?: boolean;
}
