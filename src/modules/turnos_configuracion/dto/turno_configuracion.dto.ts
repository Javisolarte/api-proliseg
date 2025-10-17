import { ApiProperty, PartialType } from "@nestjs/swagger";
import { IsString, IsOptional, IsInt, IsBoolean } from "class-validator";

export class CreateTurnoConfiguracionDto {
  @ApiProperty({ example: "Turno diurno" })
  @IsString()
  nombre: string;

  @ApiProperty({ example: "Turno de 8 horas diarias", required: false })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty({ example: 8 })
  @IsInt()
  horas_dia: number;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class UpdateTurnoConfiguracionDto extends PartialType(CreateTurnoConfiguracionDto) {}
