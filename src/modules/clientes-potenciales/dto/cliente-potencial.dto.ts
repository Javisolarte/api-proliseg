import { ApiProperty, PartialType } from "@nestjs/swagger"
import { IsString, IsOptional, IsUUID } from "class-validator"

export class CreateClientePotencialDto {
  @ApiProperty({ example: "Empresa Tecnológica S.A." })
  @IsString()
  nombre_empresa: string

  @ApiProperty({ example: "900123456-7", required: false })
  @IsOptional()
  @IsString()
  nit?: string

  @ApiProperty({ example: "Calle Falsa 123", required: false })
  @IsOptional()
  @IsString()
  direccion?: string

  @ApiProperty({ example: "3001234567", required: false })
  @IsOptional()
  @IsString()
  telefono?: string

  @ApiProperty({ example: "Juan Pérez", required: false })
  @IsOptional()
  @IsString()
  contacto?: string

  @ApiProperty({ example: "Nuevo", required: false })
  @IsOptional()
  @IsString()
  estado?: string

  @ApiProperty({ example: "Medio", required: false })
  @IsOptional()
  @IsString()
  nivel_interes?: string

  @ApiProperty({ example: "Interesados en servicio de CCTV", required: false })
  @IsOptional()
  @IsString()
  notas?: string
}

export class UpdateClientePotencialDto extends PartialType(CreateClientePotencialDto) {}
