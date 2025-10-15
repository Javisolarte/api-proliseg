import { ApiProperty, PartialType } from "@nestjs/swagger";
import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsDateString,
  IsEmail,
} from "class-validator";

export class CreateEmpleadoDto {
  @ApiProperty({ example: 1, required: false, description: "FK a usuarios_externos.id (opcional)" })
  @IsOptional()
  @IsInt()
  usuario_id?: number;

  @ApiProperty({ example: "Juan Pérez García", description: "Nombre completo del empleado" })
  @IsString()
  nombre_completo: string;

  @ApiProperty({ example: "1234567890", description: "Número de cédula" })
  @IsString()
  cedula: string;

  @ApiProperty({ example: "2020-01-15", required: false })
  @IsOptional()
  @IsDateString()
  fecha_expedicion?: string;

  @ApiProperty({ example: "1990-05-20", required: false })
  @IsOptional()
  @IsDateString()
  fecha_nacimiento?: string;

  @ApiProperty({ example: "3001234567", required: false })
  @IsOptional()
  @IsString()
  telefono?: string;

  @ApiProperty({ example: "juan.perez@ejemplo.com", required: false })
  @IsOptional()
  @IsEmail()
  correo?: string;

  @ApiProperty({ example: "Calle 123 #45-67", required: false })
  @IsOptional()
  @IsString()
  direccion?: string;

  @ApiProperty({ example: "Cundinamarca", required: false })
  @IsOptional()
  @IsString()
  departamento?: string;

  @ApiProperty({ example: "Bogotá", required: false })
  @IsOptional()
  @IsString()
  ciudad?: string;

  @ApiProperty({ example: "Soltero", required: false })
  @IsOptional()
  @IsString()
  estado_civil?: string;

  @ApiProperty({ example: "Masculino", required: false })
  @IsOptional()
  @IsString()
  genero?: string;

  @ApiProperty({ example: 1, required: false, description: "Si aún tienes este campo en la tabla" })
  @IsOptional()
  @IsInt()
  tipo_empleado_id?: number;

  @ApiProperty({ example: "Indefinido", required: false })
  @IsOptional()
  @IsString()
  tipo_contrato?: string;

  @ApiProperty({ example: "2023-01-01", description: "Fecha de ingreso (obligatoria)" })
  @IsDateString()
  fecha_ingreso: string;

  // <-- Nombre corregido para mapear exactamente a la columna de la tabla
  @ApiProperty({ example: 1, required: false, description: "ID del puesto (column 'puesto_id')" })
  @IsOptional()
  @IsInt()
  puesto_id?: number;

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsInt()
  eps_id?: number;

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsInt()
  arl_id?: number;

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsInt()
  fondo_pension_id?: number;

  @ApiProperty({ example: 48, required: false })
  @IsOptional()
  @IsInt()
  horas_trabajadas_semana?: number;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  // usamos string porque en la tabla 'empleados' existe la columna 'rol' (varchar)
  @ApiProperty({ example: "empleado", required: false, description: "Rol como texto (ej: 'empleado', 'supervisor')" })
  @IsOptional()
  @IsString()
  rol?: string;
}

export class UpdateEmpleadoDto extends PartialType(CreateEmpleadoDto) {}
