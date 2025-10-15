import { ApiProperty, PartialType } from "@nestjs/swagger"
import { IsInt, IsString, IsOptional, IsNumber, IsBoolean } from "class-validator"

export class CreatePuestoDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  contrato_id: number

  @ApiProperty({ example: "Puesto Principal - Entrada" })
  @IsString()
  nombre: string

  @ApiProperty({ example: "Calle 50 #30-20", required: false })
  @IsOptional()
  @IsString()
  direccion?: string

  @ApiProperty({ example: "Bogotá", required: false })
  @IsOptional()
  @IsString()
  ciudad?: string

  @ApiProperty({ example: 4.6097, required: false })
  @IsOptional()
  @IsNumber()
  latitud?: number

  @ApiProperty({ example: -74.0817, required: false })
  @IsOptional()
  @IsNumber()
  longitud?: number

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  activo?: boolean
}

export class UpdatePuestoDto extends PartialType(CreatePuestoDto) {}
