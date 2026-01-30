import { IsString, IsNotEmpty, IsNumber, IsOptional, IsBoolean } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class IniciarRondaDto {
    @ApiProperty()
    @IsNumber()
    ronda_definicion_id: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    turno_id?: number;
}

export class RegistrarPuntoDto {
    @ApiProperty()
    @IsNumber()
    ronda_ejecucion_id: number;

    @ApiProperty()
    @IsNumber()
    punto_id: number; // Updated from checkpoint_id

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    latitud_real?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    longitud_real?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    foto_url?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    comentario?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    es_valido?: boolean;

    // Legacy aliases for backward compatibility
    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    checkpoint_id?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    evidencia_foto_url?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    observaciones?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    coordenadas_gps?: string;
}

export class FinalizarRondaDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    estado?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    observaciones?: string;

    // Legacy alias
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    observaciones_generales?: string;
}
