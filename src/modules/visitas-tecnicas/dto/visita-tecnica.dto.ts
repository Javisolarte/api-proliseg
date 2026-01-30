import { IsString, IsNotEmpty, IsNumber, IsOptional } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateVisitaTecnicaDto {
    @ApiProperty()
    @IsNumber()
    puesto_id: number;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    tipo_visitante: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    nombre_visitante: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    empresa?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    motivo_visita?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    foto_evidencia_url?: string;
}

export class UpdateVisitaTecnicaDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    resultado_observaciones?: string;
}
