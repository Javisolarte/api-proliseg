import { ApiProperty, PartialType } from "@nestjs/swagger"
import { IsInt, IsString, IsOptional } from "class-validator"

export class CreateNovedadDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  turno_id: number

  @ApiProperty({ example: "Cambio de turno", required: false })
  @IsOptional()
  @IsString()
  tipo?: string

  @ApiProperty({ example: "El vigilante llegó 15 minutos tarde" })
  @IsString()
  descripcion: string

  @ApiProperty({ example: "bajo", enum: ["bajo", "medio", "alto"], required: false })
  @IsOptional()
  @IsString()
  nivel_alerta?: "bajo" | "medio" | "alto"
}

export class UpdateNovedadDto extends PartialType(CreateNovedadDto) {}
