import { ApiProperty, PartialType } from "@nestjs/swagger"
import { IsInt, IsString, IsOptional, IsDateString } from "class-validator"

export class CreateIncidenteDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  puesto_id: number

  @ApiProperty({ example: "Robo" })
  @IsString()
  tipo_incidente: string

  @ApiProperty({ example: "Se reportó un intento de robo en la entrada principal" })
  @IsString()
  descripcion: string

  @ApiProperty({ example: "alto", enum: ["bajo", "medio", "alto", "critico"] })
  @IsString()
  nivel_gravedad: "bajo" | "medio" | "alto" | "critico"

  @ApiProperty({ example: "2024-01-15T14:30:00Z" })
  @IsDateString()
  fecha_incidente: string

  @ApiProperty({ example: [], required: false })
  @IsOptional()
  evidencias_urls?: string[]
}

export class UpdateIncidenteDto extends PartialType(CreateIncidenteDto) {
  @ApiProperty({
    example: "en_investigacion",
    enum: ["abierto", "en_investigacion", "resuelto", "cerrado"],
    required: false,
  })
  @IsOptional()
  @IsString()
  estado?: "abierto" | "en_investigacion" | "resuelto" | "cerrado"

  @ApiProperty({ example: "Se implementaron medidas de seguridad adicionales", required: false })
  @IsOptional()
  @IsString()
  acciones_tomadas?: string
}
