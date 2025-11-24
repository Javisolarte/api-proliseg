import { ApiProperty, PartialType } from "@nestjs/swagger";
import { IsInt, IsString, IsOptional, IsNumber, IsDateString, IsBoolean } from "class-validator";
import { Transform } from "class-transformer";

export class CreateRutaGpsDto {
    @ApiProperty({ example: 1 })
    @IsInt()
    @Transform(({ value }) => parseInt(value))
    empleado_id: number;

    @ApiProperty({ example: 1 })
    @IsInt()
    @Transform(({ value }) => parseInt(value))
    puesto_id: number;

    @ApiProperty({ example: 4.6097 })
    @IsNumber()
    @Transform(({ value }) => parseFloat(value))
    latitud: number;

    @ApiProperty({ example: -74.0817 })
    @IsNumber()
    @Transform(({ value }) => parseFloat(value))
    longitud: number;

    @ApiProperty({ example: 10.5, required: false })
    @IsOptional()
    @IsNumber()
    @Transform(({ value }) => parseFloat(value))
    precision_gps?: number;

    @ApiProperty({ example: "patrulla", required: false })
    @IsOptional()
    @IsString()
    tipo_ruta?: string;

    @ApiProperty({ example: "inicio_ronda", required: false })
    @IsOptional()
    @IsString()
    evento?: string;

    @ApiProperty({ example: "Sin novedades", required: false })
    @IsOptional()
    @IsString()
    observaciones?: string;
}

export class CreateRecorridoSupervisorDto {
    @ApiProperty({ example: 1 })
    @IsInt()
    @Transform(({ value }) => parseInt(value))
    supervisor_id: number;

    @ApiProperty({ example: 1 })
    @IsInt()
    @Transform(({ value }) => parseInt(value))
    puesto_id: number;

    @ApiProperty({ example: "2023-10-27", required: false })
    @IsOptional()
    @IsDateString()
    fecha?: string;

    @ApiProperty({ example: "08:00:00", required: false })
    @IsOptional()
    @IsString()
    hora?: string;

    @ApiProperty({ example: 4.6097, required: false })
    @IsOptional()
    @IsNumber()
    @Transform(({ value }) => parseFloat(value))
    latitud?: number;

    @ApiProperty({ example: -74.0817, required: false })
    @IsOptional()
    @IsNumber()
    @Transform(({ value }) => parseFloat(value))
    longitud?: number;

    @ApiProperty({ example: "Todo en orden", required: false })
    @IsOptional()
    @IsString()
    observaciones?: string;

    @ApiProperty({ example: "Sin novedades", required: false })
    @IsOptional()
    @IsString()
    novedades?: string;

    @ApiProperty({ example: true, required: false })
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === 'true' || value === true)
    validado?: boolean;
}

export class CreateRondaRonderoDto {
    @ApiProperty({ example: 1 })
    @IsInt()
    @Transform(({ value }) => parseInt(value))
    rondero_id: number;

    @ApiProperty({ example: 1 })
    @IsInt()
    @Transform(({ value }) => parseInt(value))
    puesto_id: number;

    @ApiProperty({ example: "08:00:00" })
    @IsString()
    hora_programada: string;

    @ApiProperty({ example: "2023-10-27T08:05:00Z", required: false })
    @IsOptional()
    @IsDateString()
    hora_real?: string;

    @ApiProperty({ example: 4.6097, required: false })
    @IsOptional()
    @IsNumber()
    @Transform(({ value }) => parseFloat(value))
    latitud?: number;

    @ApiProperty({ example: -74.0817, required: false })
    @IsOptional()
    @IsNumber()
    @Transform(({ value }) => parseFloat(value))
    longitud?: number;

    @ApiProperty({ example: 5.2, required: false })
    @IsOptional()
    @IsNumber()
    @Transform(({ value }) => parseFloat(value))
    distancia_desviacion?: number;

    @ApiProperty({ example: "cumplida", required: false })
    @IsOptional()
    @IsString()
    estado?: string;

    @ApiProperty({ example: "Sin observaciones", required: false })
    @IsOptional()
    @IsString()
    observaciones?: string;

    @ApiProperty({ example: false, required: false })
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === 'true' || value === true)
    validado?: boolean;
}
