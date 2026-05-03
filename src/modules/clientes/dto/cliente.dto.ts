import { ApiProperty, PartialType } from "@nestjs/swagger"
import { IsString, IsOptional, IsInt, IsBoolean, IsEmail, MinLength } from "class-validator"

export class CreateClienteDto {
  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsInt()
  usuario_id?: number

  @ApiProperty({ example: "Empresa ABC S.A.S." })
  @IsString()
  nombre_empresa: string

  @ApiProperty({ example: "900123456-7", required: false })
  @IsOptional()
  @IsString()
  nit?: string

  @ApiProperty({ example: "Calle 100 #20-30", required: false })
  @IsOptional()
  @IsString()
  direccion?: string

  @ApiProperty({ example: "6012345678", required: false })
  @IsOptional()
  @IsString()
  telefono?: string

  @ApiProperty({ example: "correo@empresa.com", required: false })
  @IsOptional()
  @IsEmail()
  email?: string

  @ApiProperty({ example: "María González", required: false })
  @IsOptional()
  @IsString()
  contacto?: string

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  activo?: boolean

  // Campos para la creación automática de usuario
  @ApiProperty({ example: "login@empresa.com", required: false })
  @IsOptional()
  @IsEmail()
  access_email?: string

  @ApiProperty({ example: "password123", required: false })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string
}

export class UpdateClienteDto extends PartialType(CreateClienteDto) {}
