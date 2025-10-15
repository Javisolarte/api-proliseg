import { ApiProperty, PartialType } from "@nestjs/swagger"
import { IsInt, IsDateString, IsString, IsOptional } from "class-validator"

export class CreateTurnoDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  empleado_id: number

  @ApiProperty({ example: 1 })
  @IsInt()
  puesto_id: number

  @ApiProperty({ example: "2024-01-15" })
  @IsDateString()
  fecha: string

  @ApiProperty({ example: "06:00:00", required: false })
  @IsOptional()
  @IsString()
  hora_inicio?: string

  @ApiProperty({ example: "18:00:00", required: false })
  @IsOptional()
  @IsString()
  hora_fin?: string

  @ApiProperty({ example: "diurno", required: false })
  @IsOptional()
  @IsString()
  tipo_turno?: string
}

export class UpdateTurnoDto extends PartialType(CreateTurnoDto) {}
