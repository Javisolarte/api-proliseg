import { IsString, IsOptional, IsEmail, IsEnum, IsDateString, IsInt, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCorreoDto {
    @ApiProperty({ example: 'empleado@empresa.com' })
    @IsEmail()
    direccion_correo: string;

    @ApiPropertyOptional({ example: 'password123' })
    @IsOptional()
    @IsString()
    contrasena?: string;

    @ApiPropertyOptional({ example: 'corporativo' })
    @IsOptional()
    @IsString()
    proveedor?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    numero_recuperacion?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsEmail()
    correo_recuperacion?: string;

    @ApiPropertyOptional({ example: 'activo' })
    @IsOptional()
    @IsEnum(['activo', 'suspendido', 'bloqueado', 'eliminado'])
    estado?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsDateString()
    fecha_creacion_cuenta?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsInt()
    creado_por?: number;
}

export class UpdateCorreoDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsEmail()
    direccion_correo?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    contrasena?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    proveedor?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    numero_recuperacion?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsEmail()
    correo_recuperacion?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsEnum(['activo', 'suspendido', 'bloqueado', 'eliminado'])
    estado?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsDateString()
    fecha_creacion_cuenta?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsDateString()
    fecha_ultima_verificacion?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsInt()
    verificado_por?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    observaciones_verificacion?: string;
}

export class AsignarCorreoDto {
    @ApiProperty()
    @IsInt()
    correo_id: number;

    @ApiProperty()
    @IsInt()
    empleado_id: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsInt()
    asignado_por?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    observaciones?: string;
}

export class DevolverCorreoDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    observaciones?: string;
}
