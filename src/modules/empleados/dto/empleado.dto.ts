import { ApiProperty, PartialType } from "@nestjs/swagger";
import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsNumber,
} from "class-validator";
import { Transform } from "class-transformer";

export class CreateEmpleadoDto {
  @ApiProperty({ example: 1, required: false, description: "FK a usuarios_externos.id (opcional)" })
  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInt(value))
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

  @ApiProperty({ example: "Indefinido", required: false })
  @IsOptional()
  @IsString()
  tipo_contrato?: string;

  @ApiProperty({ example: "2023-01-01", description: "Fecha de ingreso (obligatoria)" })
  @IsDateString()
  fecha_ingreso: string;

  @ApiProperty({ example: "2024-01-01", required: false })
  @IsOptional()
  @IsDateString()
  fecha_salida?: string;

  @ApiProperty({ example: "Renuncia voluntaria", required: false })
  @IsOptional()
  @IsString()
  motivo_salida?: string;

  @ApiProperty({ example: 1, required: false, description: "ID del puesto (column 'puesto_id')" })
  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  puesto_id?: number;

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  eps_id?: number;

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  arl_id?: number;

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  fondo_pension_id?: number;

  @ApiProperty({ example: "2023-01-01", required: false })
  @IsOptional()
  @IsDateString()
  fecha_afiliacion_eps?: string;

  @ApiProperty({ example: "2024-01-01", required: false })
  @IsOptional()
  @IsDateString()
  fecha_fin_eps?: string;

  @ApiProperty({ example: "2023-01-01", required: false })
  @IsOptional()
  @IsDateString()
  fecha_afiliacion_arl?: string;

  @ApiProperty({ example: "2024-01-01", required: false })
  @IsOptional()
  @IsDateString()
  fecha_fin_arl?: string;

  @ApiProperty({ example: "2023-01-01", required: false })
  @IsOptional()
  @IsDateString()
  fecha_afiliacion_pension?: string;

  @ApiProperty({ example: "2024-01-01", required: false })
  @IsOptional()
  @IsDateString()
  fecha_fin_pension?: string;

  @ApiProperty({ example: 48, required: false })
  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  horas_trabajadas_semana?: number;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  activo?: boolean;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  verificado_documentos?: boolean;

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  verificado_por?: number;

  @ApiProperty({ example: "2023-01-01T10:00:00Z", required: false })
  @IsOptional()
  @IsDateString()
  fecha_verificacion?: string;

  @ApiProperty({ example: "empleado", required: false, description: "Rol como texto (ej: 'empleado', 'supervisor')" })
  @IsOptional()
  @IsString()
  rol?: string;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  asignado?: boolean;

  @ApiProperty({ example: 0, required: false })
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseFloat(value))
  nivel_confianza?: number;

  @ApiProperty({ example: 0, required: false })
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseFloat(value))
  riesgo_ausencia?: number;

  @ApiProperty({ example: 0, required: false })
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseFloat(value))
  rendimiento_promedio?: number;

  @ApiProperty({ example: "2023-01-01T10:00:00Z", required: false })
  @IsOptional()
  @IsDateString()
  ultima_evaluacion?: string;

  @ApiProperty({ example: 1, required: false, description: "ID del salario asignado" })
  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  salario_id?: number;

  @ApiProperty({
    example: "Bachiller",
    required: false,
    description: "Nivel de formación académica (ej: Bachiller, Técnico, Tecnólogo, Profesional, Especialización, Maestría, Doctorado)"
  })
  @IsOptional()
  @IsString()
  formacion_academica?: string;
}

export class UpdateEmpleadoDto extends PartialType(CreateEmpleadoDto) { }
