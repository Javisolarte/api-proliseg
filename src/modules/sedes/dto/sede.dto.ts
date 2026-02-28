import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateSedeDto {
    @ApiProperty({ description: "Nombre de la Sede" })
    nombre: string;
    @ApiProperty({ description: "Dirección de la Sede" })
    direccion: string;
    @ApiProperty({ description: "Ciudad de la Sede" })
    ciudad: string;
    @ApiPropertyOptional({ description: "Departamento de la Sede" })
    departamento?: string;
    @ApiPropertyOptional({ description: "Código Postal de la Sede" })
    codigo_postal?: string;
    @ApiPropertyOptional({ description: "Teléfono de la Sede" })
    telefono?: string;
    @ApiPropertyOptional({ description: "Email de la Sede" })
    email?: string;
    @ApiPropertyOptional({ description: "Latitud de la Sede" })
    latitud?: number;
    @ApiPropertyOptional({ description: "Longitud de la Sede" })
    longitud?: number;
    @ApiPropertyOptional({ description: "Estado activo de la Sede" })
    activa?: boolean;
}

export class UpdateSedeDto extends CreateSedeDto { }
