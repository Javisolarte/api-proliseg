import { ApiProperty, PartialType } from "@nestjs/swagger";
import {
  IsInt,
  IsOptional,
  IsString,
  IsNumber,
  IsDateString,
  IsPositive,
} from "class-validator";

export class CreateTurnoDto {
  @ApiProperty({
    example: 23,
    description: "ID del empleado asignado al turno",
  })
  @IsInt()
  empleado_id: number;

  @ApiProperty({
    example: 8,
    description: "ID del puesto principal donde se realiza el turno",
  })
  @IsInt()
  puesto_id: number;

  @ApiProperty({
    example: 15,
    description: "ID del subpuesto (si aplica)",
    required: false,
  })
  @IsOptional()
  @IsInt()
  subpuesto_id?: number;

  @ApiProperty({
    example: "2025-10-17",
    description: "Fecha del turno (YYYY-MM-DD)",
  })
  @IsDateString()
  fecha: string;

  @ApiProperty({
    example: "08:00",
    description: "Hora de inicio del turno (HH:mm)",
  })
  @IsString()
  hora_inicio: string;

  @ApiProperty({
    example: "18:00",
    description: "Hora de finalización del turno (HH:mm)",
  })
  @IsString()
  hora_fin: string;

  @ApiProperty({
    example: "Diurno",
    description: "Tipo de turno (ej: Diurno, Nocturno, Mixto)",
    required: false,
  })
  @IsOptional()
  @IsString()
  tipo_turno?: string;

  @ApiProperty({
    example: "Activo",
    description: "Estado del turno (ej: Activo, Cancelado, Completado)",
    required: false,
  })
  @IsOptional()
  @IsString()
  estado_turno?: string;

  @ApiProperty({
    example: 10,
    description: "Horas reportadas por el empleado (opcional)",
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  horas_reportadas?: number;

  @ApiProperty({
    example: 8,
    description: "Duración total del turno en horas (opcional)",
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  duracion_horas?: number;
}

export class UpdateTurnoDto extends PartialType(CreateTurnoDto) { }

export class TurnoDto extends CreateTurnoDto {
  @ApiProperty({
    example: 1,
    description: "ID único del turno",
  })
  @IsInt()
  id: number;
}
