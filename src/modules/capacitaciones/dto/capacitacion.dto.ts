import { ApiProperty, PartialType } from "@nestjs/swagger"
import { IsString, IsOptional, IsInt, IsBoolean } from "class-validator"

export class CreateCapacitacionDto {
  @ApiProperty({ example: "Manejo de armas" })
  @IsString()
  nombre: string

  @ApiProperty({ example: "Capacitación en uso y manejo de armas de fuego", required: false })
  @IsOptional()
  @IsString()
  descripcion?: string

  @ApiProperty({ example: 40, required: false })
  @IsOptional()
  @IsInt()
  duracion_horas?: number

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  obligatoria?: boolean

  @ApiProperty({ example: 12, required: false })
  @IsOptional()
  @IsInt()
  vigencia_meses?: number

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  activa?: boolean
}

export class UpdateCapacitacionDto extends PartialType(CreateCapacitacionDto) {}
