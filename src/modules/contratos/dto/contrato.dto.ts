import { ApiProperty, PartialType } from "@nestjs/swagger"
import { IsInt, IsString, IsOptional, IsNumber, IsDateString, IsBoolean } from "class-validator"

export class CreateContratoDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  cliente_id: number

  @ApiProperty({ example: "Vigilancia 24/7", required: false })
  @IsOptional()
  @IsString()
  tipo_contrato?: string

  @ApiProperty({ example: 50000000, required: false })
  @IsOptional()
  @IsNumber()
  valor?: number

  @ApiProperty({ example: 10, required: false })
  @IsOptional()
  @IsInt()
  numero_guardas?: number

  @ApiProperty({ example: "2024-01-01", required: false })
  @IsOptional()
  @IsDateString()
  fecha_inicio?: string

  @ApiProperty({ example: "2024-12-31", required: false })
  @IsOptional()
  @IsDateString()
  fecha_fin?: string

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  estado?: boolean
}

export class UpdateContratoDto extends PartialType(CreateContratoDto) {}
