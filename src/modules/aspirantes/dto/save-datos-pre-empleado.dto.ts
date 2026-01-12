import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class SaveDatosPreEmpleadoDto {
    @ApiProperty({ description: 'Nombre completo (confirmación)', example: 'Juan Pérez' })
    @IsString()
    @IsNotEmpty()
    nombre_completo: string;

    @ApiProperty({ description: 'Cédula', example: '1234567890' })
    @IsString()
    @IsNotEmpty()
    cedula: string;

    @ApiPropertyOptional({ description: 'Fecha de expedición de la cédula', example: '2000-01-01' })
    @IsDateString()
    @IsOptional()
    fecha_expedicion?: string;

    @ApiPropertyOptional({ description: 'Lugar de expedición', example: 'Bogotá' })
    @IsString()
    @IsOptional()
    lugar_expedicion?: string;

    @ApiPropertyOptional({ description: 'Fecha de nacimiento', example: '1990-05-15' })
    @IsDateString()
    @IsOptional()
    fecha_nacimiento?: string;

    @ApiPropertyOptional({ description: 'Género', example: 'M' })
    @IsString()
    @IsOptional()
    genero?: string;

    @ApiPropertyOptional({ description: 'Grupo Sanguíneo (RH)', example: 'O+' })
    @IsString()
    @IsOptional()
    rh?: string;

    @ApiPropertyOptional({ description: 'Estado Civil', example: 'Soltero' })
    @IsString()
    @IsOptional()
    estado_civil?: string;

    @ApiPropertyOptional({ description: 'Teléfono principal', example: '3001234567' })
    @IsString()
    @IsOptional()
    telefono?: string;

    @ApiPropertyOptional({ description: 'Teléfono secundario', example: '6011234567' })
    @IsString()
    @IsOptional()
    telefono_secundario?: string;

    @ApiPropertyOptional({ description: 'Correo electrónico', example: 'juan@email.com' })
    @IsEmail()
    @IsOptional()
    correo?: string;

    @ApiPropertyOptional({ description: 'Departamento de residencia', example: 'Cundinamarca' })
    @IsString()
    @IsOptional()
    departamento?: string;

    @ApiPropertyOptional({ description: 'Ciudad de residencia', example: 'Bogotá' })
    @IsString()
    @IsOptional()
    ciudad?: string;

    @ApiPropertyOptional({ description: 'Dirección de residencia', example: 'Cr 7 # 100-20' })
    @IsString()
    @IsOptional()
    direccion?: string;

    @ApiPropertyOptional({ description: 'Formación académica', example: 'Bachiller' })
    @IsString()
    @IsOptional()
    formacion_academica?: string;

    @ApiPropertyOptional({ description: 'ID de la EPS', example: 1 })
    @IsNumber()
    @IsOptional()
    eps_id?: number;

    @ApiPropertyOptional({ description: 'ID de la ARL (si aplica)', example: 1 })
    @IsNumber()
    @IsOptional()
    arl_id?: number;

    @ApiPropertyOptional({ description: 'ID del Fondo de Pensiones', example: 1 })
    @IsNumber()
    @IsOptional()
    fondo_pension_id?: number;

    @ApiPropertyOptional({ description: '¿Tiene alguna discapacidad?', default: false })
    @IsBoolean()
    @IsOptional()
    tiene_discapacidad?: boolean;

    @ApiPropertyOptional({ description: 'Observación sobre la discapacidad', example: 'Ninguna' })
    @IsString()
    @IsOptional()
    observacion_discapacidad?: string;

    @ApiPropertyOptional({ description: 'Indica si ha completado el formulario', default: true })
    @IsBoolean()
    @IsOptional()
    completado?: boolean;
}
