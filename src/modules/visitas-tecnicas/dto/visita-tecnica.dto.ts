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

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    estado?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    asignado_a?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    fecha_programada?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    hora_programada?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    notas_programacion?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    solicitado_por_tipo?: 'usuario' | 'cliente';

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    solicitado_por_id?: number;
}

export class UpdateVisitaTecnicaDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    resultado_observaciones?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    estado?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    foto_evidencia_url?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    cumplida?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    documento_generado_id?: number;
}
