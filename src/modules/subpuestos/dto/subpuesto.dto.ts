import { IsInt, IsNotEmpty, IsOptional, IsString, Min, IsBoolean } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateSubpuestoDto {
  @ApiProperty({
    example: 12,
    description: "ID del puesto padre (el puesto principal al que pertenece este subpuesto)",
  })
  @IsNotEmpty()
  @IsInt()
  parent_id: number;

  @ApiProperty({
    example: "Subpuesto A - Entrada Principal",
    description: "Nombre del subpuesto",
  })
  @IsNotEmpty()
  @IsString()
  nombre: string;

  @ApiPropertyOptional({
    example: "Av. Las Palmas #45-67",
    description: "Dirección física o descripción del subpuesto (opcional)",
  })
  @IsOptional()
  @IsString()
  direccion?: string;

  @ApiPropertyOptional({
    example: "Cali",
    description: "Ciudad donde se ubica el subpuesto (opcional)",
  })
  @IsOptional()
  @IsString()
  ciudad?: string;

  @ApiProperty({
    example: 3,
    description:
      "Número de guardas asignados a este subpuesto. El total no debe superar el límite del contrato.",
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  numero_guardas: number;

  @ApiPropertyOptional({
    example: 5,
    description:
      "ID de la configuración de turnos asociada (referencia a turnos_configuracion.id). Opcional.",
  })
  @IsOptional()
  @IsInt()
  configuracion_id?: number;
}

export class UpdateSubpuestoDto {
  @ApiPropertyOptional({
    example: "Subpuesto B - Zona Posterior",
    description: "Nombre del subpuesto (opcional)",
  })
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiPropertyOptional({
    example: "Carrera 80 #20-50",
    description: "Dirección o descripción del subpuesto (opcional)",
  })
  @IsOptional()
  @IsString()
  direccion?: string;

  @ApiPropertyOptional({
    example: "Bogotá",
    description: "Ciudad donde se ubica el subpuesto (opcional)",
  })
  @IsOptional()
  @IsString()
  ciudad?: string;

  @ApiPropertyOptional({
    example: 2,
    description:
      "Número de guardas asignados al subpuesto (opcional, debe respetar el límite del contrato padre)",
  })
  @IsOptional()
  @IsInt()
  numero_guardas?: number;

  @ApiPropertyOptional({
    example: 4,
    description: "ID de la configuración de turnos asociada (opcional)",
  })
  @IsOptional()
  @IsInt()
  configuracion_id?: number;

  @ApiPropertyOptional({
    example: true,
    description: "Indica si el subpuesto está activo o no",
  })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
