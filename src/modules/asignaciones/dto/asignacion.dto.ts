import { ApiProperty, PartialType } from "@nestjs/swagger";
import { IsInt, IsOptional, IsBoolean, IsString, IsDateString } from "class-validator";

export class CreateAsignacionDto {
  @ApiProperty({ example: 1, description: "ID del empleado asignado" })
  @IsInt()
  empleado_id: number;

  @ApiProperty({ example: 2, description: "ID del puesto de trabajo (opcional si se usa subpuesto)", required: false })
  @IsOptional()
  @IsInt()
  puesto_id?: number;

  @ApiProperty({ example: 3, description: "ID del subpuesto de trabajo (opcional)", required: false })
  @IsOptional()
  @IsInt()
  subpuesto_id?: number;

  @ApiProperty({ example: 5, description: "Usuario que realiza la asignación" })
  @IsInt()
  asignado_por: number;

  @ApiProperty({ example: "Asignado para turno nocturno", required: false })
  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class UpdateAsignacionDto extends PartialType(CreateAsignacionDto) {
  @ApiProperty({ example: false, description: "Indica si la asignación está activa o no", required: false })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiProperty({ example: "2025-10-17", required: false })
  @IsOptional()
  @IsDateString()
  fecha_fin?: string;

  @ApiProperty({ example: "23:00:00", required: false })
  @IsOptional()
  @IsString()
  hora_fin?: string;

  @ApiProperty({ example: "Fin de contrato", required: false })
  @IsOptional()
  @IsString()
  motivo_finalizacion?: string;
}
