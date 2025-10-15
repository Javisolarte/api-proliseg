import { ApiProperty } from "@nestjs/swagger"
import { IsInt, IsString, IsOptional, IsNumber } from "class-validator"

export class CreateAsistenciaDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  turno_id: number

  @ApiProperty({ example: "entrada", enum: ["entrada", "salida"] })
  @IsString()
  tipo_marca: "entrada" | "salida"

  @ApiProperty({ example: 4.6097, required: false })
  @IsOptional()
  @IsNumber()
  latitud?: number

  @ApiProperty({ example: -74.0817, required: false })
  @IsOptional()
  @IsNumber()
  longitud?: number
}
