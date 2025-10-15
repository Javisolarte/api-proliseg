import { ApiProperty, PartialType } from "@nestjs/swagger"
import { IsString, IsOptional, IsInt, IsBoolean } from "class-validator"

export class CreateRolDto {
  @ApiProperty({ example: "coordinador_operativo" })
  @IsString()
  nombre: string

  @ApiProperty({ example: "Coordinador de operaciones de campo", required: false })
  @IsOptional()
  @IsString()
  descripcion?: string

  @ApiProperty({ example: 5, required: false })
  @IsOptional()
  @IsInt()
  nivel_jerarquia?: number

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  activo?: boolean
}

export class UpdateRolDto extends PartialType(CreateRolDto) {}

export class AsignarModuloRolDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  modulo_id: number
}
