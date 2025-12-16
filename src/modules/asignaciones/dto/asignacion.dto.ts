import { ApiProperty, PartialType } from "@nestjs/swagger";
import { IsInt, IsOptional, IsBoolean, IsString, IsDateString } from "class-validator";

export class CreateAsignacionDto {
  @ApiProperty({ example: 1, description: "ID del empleado asignado" })
  @IsInt()
  empleado_id: number;

  @ApiProperty({
    example: 2,
    description: "ID del puesto de trabajo (se obtiene automáticamente del subpuesto)",
    required: false
  })
  @IsOptional()
  @IsInt()
  puesto_id?: number;

  @ApiProperty({
    example: 3,
    description: "ID del subpuesto de trabajo (REQUERIDO - la configuración de turnos se obtiene del subpuesto)"
  })
  @IsInt()
  subpuesto_id: number;

  @ApiProperty({ example: 5, description: "Usuario que realiza la asignación" })
  @IsInt()
  asignado_por: number;

  @ApiProperty({ example: "Asignado para turno nocturno", required: false })
  @IsOptional()
  @IsString()
  observaciones?: string;

  @ApiProperty({
    example: 10,
    description: "ID del contrato asociado a la asignación (se obtiene automáticamente del puesto)",
    required: false
  })
  @IsOptional()
  @IsInt()
  contrato_id?: number;
}

export class UpdateAsignacionDto extends PartialType(CreateAsignacionDto) {
  @ApiProperty({ example: false, description: "Indica si la asignación está activa o no", required: false })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiProperty({ example: "2025-10-17", description: "Fecha final de la asignación (opcional)", required: false })
  @IsOptional()
  @IsDateString()
  fecha_fin?: string;

  @ApiProperty({ example: "23:00:00", description: "Hora final de la asignación (opcional)", required: false })
  @IsOptional()
  @IsString()
  hora_fin?: string;

  @ApiProperty({ example: "Fin de contrato", description: "Motivo de finalización de la asignación (opcional)", required: false })
  @IsOptional()
  @IsString()
  motivo_finalizacion?: string;
}
