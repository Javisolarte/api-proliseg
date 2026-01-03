import { ApiProperty, PartialType } from "@nestjs/swagger";
import { IsInt, IsString, IsOptional, IsNumber, IsDateString, IsBoolean, IsArray, ValidateNested } from "class-validator";
import { Transform, Type } from "class-transformer";

// --- DTOs Originales (Conservados) ---
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

// --- Nuevos DTOs para Supervisión ---

export class CreateRutaSupervisionDto {
    @ApiProperty({ example: 'Ruta Zona Norte' })
    @IsString()
    nombre: string;

    @ApiProperty({ example: 'Ruta de supervisión para puestos de la zona norte' })
    @IsString()
    @IsOptional()
    descripcion?: string;

    @ApiProperty({ example: true })
    @IsBoolean()
    @IsOptional()
    activa?: boolean;

    @ApiProperty({ example: 'Bogotá', required: false })
    @IsString()
    @IsOptional()
    ciudad?: string;

    @ApiProperty({ example: 'Cundinamarca', required: false })
    @IsString()
    @IsOptional()
    departamento?: string;
}

export class UpdateRutaSupervisionDto extends PartialType(CreateRutaSupervisionDto) { }

export class CreateRutaPuntoDto {
    @ApiProperty({ example: 1 })
    @IsInt()
    puesto_id: number;

    @ApiProperty({ example: 1 })
    @IsInt()
    orden: number;

    @ApiProperty({ example: 50 })
    @IsInt()
    @IsOptional()
    radio_metros?: number;
}

export class CreateRutaAsignacionDto {
    @ApiProperty({ example: 1 })
    @IsInt()
    ruta_id: number;

    @ApiProperty({ example: 100 })
    @IsInt()
    turno_id: number;

    @ApiProperty({ example: 1 })
    @IsInt()
    supervisor_id: number;

    @ApiProperty({ example: 1, required: false })
    @IsInt()
    @IsOptional()
    vehiculo_id?: number;
}

export class CreateRutaEjecucionDto {
    @ApiProperty({ example: 1 })
    @IsInt()
    ruta_asignacion_id: number;

    @ApiProperty({ example: 1 })
    @IsInt()
    supervisor_id: number;

    @ApiProperty({ example: 1, required: false })
    @IsInt()
    @IsOptional()
    vehiculo_id?: number;
}

export class FinalizarRutaEjecucionDto {
    @ApiProperty({ example: 1 })
    @IsInt()
    ejecucion_id: number;
}

export class CreateRutaEventoDto {
    @ApiProperty({ example: 1 })
    @IsInt()
    ejecucion_id: number;

    @ApiProperty({ example: 4.6097 })
    @IsNumber()
    latitud: number;

    @ApiProperty({ example: -74.0817 })
    @IsNumber()
    longitud: number;

    @ApiProperty({ example: 'gps', enum: ['gps', 'llegada', 'salida', 'detencion', 'incidencia'] })
    @IsString()
    tipo_evento: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    observacion?: string;
}
