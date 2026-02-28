import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, IsEmail } from "class-validator";

export class CreateSedeDto {
    @ApiProperty({ description: "Nombre de la Sede" })
    @IsString()
    @IsNotEmpty()
    nombre: string;

    @ApiProperty({ description: "Dirección de la Sede" })
    @IsString()
    @IsNotEmpty()
    direccion: string;

    @ApiProperty({ description: "Ciudad de la Sede" })
    @IsString()
    @IsNotEmpty()
    ciudad: string;

    @ApiPropertyOptional({ description: "Departamento de la Sede" })
    @IsString()
    @IsOptional()
    departamento?: string;

    @ApiPropertyOptional({ description: "Código Postal de la Sede" })
    @IsString()
    @IsOptional()
    codigo_postal?: string;

    @ApiPropertyOptional({ description: "Teléfono de la Sede" })
    @IsString()
    @IsOptional()
    telefono?: string;

    @ApiPropertyOptional({ description: "Email de la Sede" })
    @IsEmail()
    @IsOptional()
    email?: string;

    @ApiPropertyOptional({ description: "Latitud de la Sede" })
    @IsNumber()
    @IsOptional()
    latitud?: number;

    @ApiPropertyOptional({ description: "Longitud de la Sede" })
    @IsNumber()
    @IsOptional()
    longitud?: number;

    @ApiPropertyOptional({ description: "Estado activo de la Sede" })
    @IsBoolean()
    @IsOptional()
    activa?: boolean;
}

export class UpdateSedeDto extends CreateSedeDto { }
