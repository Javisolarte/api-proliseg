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

export class UpdateUserDto {
  @ApiPropertyOptional({ example: "usuario@gmail.com" })
  @IsOptional()
  @IsEmail({}, { message: "El correo electrónico debe ser válido" })
  email?: string;

  @ApiPropertyOptional({ example: "Juan Pérez Actualizado" })
  @IsOptional()
  @IsString({ message: "El nombre completo debe ser una cadena de texto" })
  nombre_completo?: string;

  @ApiPropertyOptional({ example: "222222222" })
  @IsOptional()
  @IsString({ message: "La cédula debe ser una cadena de texto" })
  cedula?: string;

  @ApiPropertyOptional({ example: "3001234567" })
  @IsOptional()
  @IsString({ message: "El teléfono debe ser una cadena de texto" })
  telefono?: string;

  @ApiPropertyOptional({ example: "vigilante" })
  @IsOptional()
  @IsString({ message: "El rol debe ser una cadena de texto" })
  rol?: string;
}

export class UpdateStatusDto {
  @ApiProperty({ example: true, description: "Estado activo/inactivo del usuario" })
  @IsOptional() // In case they just want to toggle or it defaults to something
  estado: boolean;
}

export class ForgotPasswordDto {
  @ApiProperty({
    example: "usuario@gmail.com",
    description: "Correo electrónico para recuperación de contraseña",
  })
  @IsEmail({}, { message: "El correo electrónico debe ser válido" })
  email: string;
}
