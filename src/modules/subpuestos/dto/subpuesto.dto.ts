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

  @ApiProperty({
    example: "Vigilancia en la entrada principal del edificio",
    description: "Descripción detallada del subpuesto y sus responsabilidades",
    required: false,
  })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty({
    example: 1,
    description:
      "Cantidad de personas que deben estar activas simultáneamente en este subpuesto. NO representa empleados totales, solo demanda operativa.",
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  guardas_activos: number;

  @ApiProperty({
    example: 5,
    description:
      "ID de la configuración de turnos asociada (referencia a turnos_configuracion.id). OBLIGATORIO para calcular guardas necesarios.",
  })
  @IsNotEmpty()
  @IsInt()
  configuracion_id: number;
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
    example: "Control de acceso vehicular",
    description: "Descripción del subpuesto (opcional)",
  })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiPropertyOptional({
    example: 2,
    description:
      "Cantidad de personas activas simultáneamente en el subpuesto (opcional)",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  guardas_activos?: number;

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

/**
 * DTO de respuesta para guardas necesarios por subpuesto
 * Basado en la vista vw_guardas_necesarios_subpuesto
 */
export class GuardasNecesariosSubpuestoDto {
  @ApiProperty({
    example: 1,
    description: "ID del subpuesto",
  })
  subpuesto_id: number;

  @ApiProperty({
    example: "Subpuesto A - Entrada Principal",
    description: "Nombre del subpuesto",
  })
  nombre: string;

  @ApiProperty({
    example: 1,
    description: "Cantidad de personas activas simultáneamente requeridas",
  })
  guardas_activos: number;

  @ApiProperty({
    example: 3,
    description: "Cantidad de estados distintos en el ciclo de turnos (DIA, NOCHE, DESCANSO)",
  })
  estados_ciclo: number;

  @ApiProperty({
    example: 3,
    description: "Guardas necesarios calculados (guardas_activos × estados_ciclo)",
  })
  guardas_necesarios: number;

  @ApiProperty({
    example: 2,
    description: "Empleados actualmente asignados a este subpuesto",
  })
  empleados_asignados?: number;

  @ApiProperty({
    example: 1,
    description: "Cupos disponibles (guardas_necesarios - empleados_asignados)",
  })
  cupos_disponibles?: number;
}
