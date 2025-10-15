import { ApiProperty } from "@nestjs/swagger"
import { IsString, IsOptional, IsBoolean, IsInt } from "class-validator"

export class UpdateUsuarioDto {
  @ApiProperty({ example: "Juan Pérez García", required: false })
  @IsOptional()
  @IsString()
  nombre_completo?: string

  @ApiProperty({ example: "3001234567", required: false })
  @IsOptional()
  @IsString()
  telefono?: string

  @ApiProperty({ example: "supervisor", required: false })
  @IsOptional()
  @IsString()
  rol?: string

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  estado?: boolean
}

export class AsignarModuloDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  modulo_id: number

  @ApiProperty({ example: true })
  @IsBoolean()
  concedido: boolean
}
