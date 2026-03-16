import { IsString, IsNotEmpty, IsNumber, IsOptional, IsArray } from "class-validator";
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

    @ApiProperty({ required: false, type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    fotos_evidencia_urls?: string[];

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

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    novedades?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    conclusion?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    costo_arreglo?: number;

    @ApiProperty({ required: false, type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    notificar_por?: string[];
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

    @ApiProperty({ required: false, type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    fotos_evidencia_urls?: string[];

    @ApiProperty({ required: false })
    @IsOptional()
    cumplida?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    documento_generado_id?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    novedades?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    conclusion?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    costo_arreglo?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    validado?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    validado_por?: number;
}
