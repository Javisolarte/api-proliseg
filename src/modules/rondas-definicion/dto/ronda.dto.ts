import { IsString, IsNotEmpty, IsNumber, IsOptional, IsBoolean } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateRondaDefinicionDto {
    @ApiProperty()
    @IsNumber()
    puesto_id: number;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    nombre: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    descripcion?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    frecuencia_minutos?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    tiempo_estimado_minutos?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    requiere_orden?: boolean;

    @ApiProperty({ required: false, default: true })
    @IsOptional()
    @IsBoolean()
    activa?: boolean;
}

export class CreatePuntoDto {
    @ApiProperty()
    @IsNumber()
    ronda_definicion_id: number;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    nombre_punto: string; // Updated from nombre

    @ApiProperty()
    @IsNumber()
    orden: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    codigo_nfc_qr?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    tipo_verificacion?: string; // Legacy support

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    latitud_esperada?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    longitud_esperada?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    instrucciones?: string;

    // Legacy aliases
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    codigo_nfc?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    coordenadas_gps?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    obligatorio?: boolean;
}
