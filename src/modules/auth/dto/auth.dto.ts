import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength, IsOptional } from "class-validator";

export class LoginDto {
  @ApiProperty({
    example: "settingspyp@gmail.com",
    description: "Correo electrónico del usuario, debe ser válido",
  })
  @IsEmail({}, { message: "El correo electrónico debe ser válido" })
  email: string;

  @ApiProperty({
    example: "1004192496",
    description: "Contraseña del usuario, mínimo 6 caracteres",
  })
  @IsString({ message: "La contraseña debe ser una cadena de texto" })
  @MinLength(6, { message: "La contraseña debe tener al menos 6 caracteres" })
  password: string;
}

export class RegisterDto {
  @ApiProperty({
    example: "usuario@gmail.com",
    description: "Correo electrónico del usuario",
  })
  @IsEmail({}, { message: "El correo electrónico debe ser válido" })
  email: string;

  @ApiProperty({  
    example: "1004192496",
    description: "Contraseña del usuario, mínimo 6 caracteres",
  })
  @IsString({ message: "La contraseña debe ser una cadena de texto" })
  @MinLength(6, { message: "La contraseña debe tener al menos 6 caracteres" })
  password: string;

  @ApiProperty({
    example: "Juan Pérez",
    description: "Nombre completo del usuario",
  })
  @IsString({ message: "El nombre completo debe ser una cadena de texto" })
  nombre_completo: string;

  @ApiProperty({
    example: "222222222",
    description: "Número de cédula del usuario",
  })
  @IsString({ message: "La cédula debe ser una cadena de texto" })
  cedula: string;

  @ApiPropertyOptional({
    example: "3001234567",
    description: "Número de teléfono del usuario (opcional)",
  })
  @IsOptional()
  @IsString({ message: "El teléfono debe ser una cadena de texto" })
  telefono?: string;

  @ApiPropertyOptional({
    example: "vigilante",
    description: "Rol del usuario (opcional)",
  })
  @IsOptional()
  @IsString({ message: "El rol debe ser una cadena de texto" })
  rol?: string;
}
