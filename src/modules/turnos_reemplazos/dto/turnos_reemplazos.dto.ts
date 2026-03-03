import { ApiProperty, PartialType } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, IsIn } from "class-validator";

export class CreateTurnoReemplazoDto {
  @ApiProperty({ example: 15 })
  @IsInt()
  turno_original_id: number;

  @ApiProperty({ example: 8 })
  @IsInt()
  empleado_reemplazo_id: number;

  @ApiProperty({ example: "Ausencia justificada por incapacidad" })
  @IsOptional()
  @IsString()
  motivo?: string;

  @ApiProperty({ example: 3, description: "ID del usuario que autoriza el reemplazo" })
  @IsOptional()
  @IsInt()
  autorizado_por?: number;

  @ApiProperty({ example: "pendiente", enum: ["pendiente", "aprobado", "rechazado", "ejecutado"] })
  @IsOptional()
  @IsIn(["pendiente", "aprobado", "rechazado", "ejecutado"])
  estado?: string;
}


export class CreateTurnoReemplazoRangoDto {
  @ApiProperty({ example: 412, description: "ID del empleado titular a ser reemplazado" })
  @IsInt()
  empleado_original_id: number;

  @ApiProperty({ example: 8, description: "ID del empleado que cubrirá el reemplazo" })
  @IsInt()
  empleado_reemplazo_id: number;

  @ApiProperty({ example: "2026-03-10", description: "Fecha de inicio del rango (YYYY-MM-DD)" })
  @IsString()
  fecha_inicio: string;

  @ApiProperty({ example: "2026-03-20", description: "Fecha de fin del rango (YYYY-MM-DD)" })
  @IsString()
  fecha_fin: string;

  @ApiProperty({ example: "Vacaciones" })
  @IsString()
  motivo: string;

  @ApiProperty({ example: 203, description: "ID del usuario que autoriza" })
  @IsOptional()
  @IsInt()
  autorizado_por?: number;
}

export class UpdateTurnoReemplazoDto extends PartialType(CreateTurnoReemplazoDto) { }
