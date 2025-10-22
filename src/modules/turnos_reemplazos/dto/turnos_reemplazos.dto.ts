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

export class UpdateTurnoReemplazoDto extends PartialType(CreateTurnoReemplazoDto) {}
