import { ApiProperty, PartialType } from "@nestjs/swagger"
import { IsInt, IsString, IsOptional, IsBoolean } from "class-validator"

export class CreateMinutaDto {
  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsInt()
  turno_id?: number

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsInt()
  puesto_id?: number

  @ApiProperty({ example: "Todo en orden durante el turno. Sin novedades." })
  @IsString()
  contenido: string

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  visible_para_cliente?: boolean
}

export class UpdateMinutaDto extends PartialType(CreateMinutaDto) {}
