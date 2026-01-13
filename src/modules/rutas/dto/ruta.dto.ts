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

// ============================================================
// DTOs para Sistema de Asignación Automática de Rutas
// ============================================================

/**
 * DTO para asignar rutas automáticamente por fecha
 * Busca todos los turnos de supervisores en la fecha y asigna rutas según tipo_turno
 */
export class AsignarRutasPorFechaDto {
    @ApiProperty({
        example: '2026-01-15',
        description: 'Fecha para procesar asignaciones (formato: YYYY-MM-DD)'
    })
    @IsDateString()
    fecha: string;

    @ApiProperty({
        example: false,
        description: 'Si es true, reemplaza asignaciones existentes. Si es false, solo crea las que no existen',
        required: false,
        default: false
    })
    @IsBoolean()
    @IsOptional()
    forzar_reasignacion?: boolean;
}

/**
 * DTO para asignar ruta manualmente a un turno específico
 */
export class AsignarRutaManualDto {
    @ApiProperty({
        example: 100,
        description: 'ID del turno al que se asignará la ruta'
    })
    @IsInt()
    turno_id: number;

    @ApiProperty({
        example: 1,
        description: 'ID de la ruta a asignar (opcional, si no se envía busca por tipo_turno)',
        required: false
    })
    @IsInt()
    @IsOptional()
    ruta_id?: number;

    @ApiProperty({
        example: 1,
        description: 'ID del vehículo a asignar (opcional, si no se envía busca el vehículo del supervisor)',
        required: false
    })
    @IsInt()
    @IsOptional()
    vehiculo_id?: number;
}

/**
 * DTO de respuesta para resultado individual de asignación
 */
export class AsignacionRutaResultDto {
    @ApiProperty({ example: 100 })
    turno_id: number;

    @ApiProperty({ example: 5 })
    empleado_id: number;

    @ApiProperty({ example: 'JUAN PEREZ' })
    empleado_nombre: string;

    @ApiProperty({ example: 'diurno' })
    tipo_turno: string;

    @ApiProperty({ example: 1 })
    ruta_id?: number;

    @ApiProperty({ example: 'RUTA DIA' })
    ruta_nombre?: string;

    @ApiProperty({ example: 2 })
    vehiculo_id?: number;

    @ApiProperty({ example: 'ABC123' })
    vehiculo_placa?: string;

    @ApiProperty({ example: true })
    asignado: boolean;

    @ApiProperty({ example: 'Ruta asignada correctamente' })
    mensaje: string;
}

/**
 * DTO de respuesta para asignación múltiple por fecha
 */
export class AsignacionRutasMasivaResponseDto {
    @ApiProperty({ example: '2026-01-15' })
    fecha: string;

    @ApiProperty({ example: 10 })
    total_turnos_procesados: number;

    @ApiProperty({ example: 8 })
    total_asignaciones_exitosas: number;

    @ApiProperty({ example: 2 })
    total_errores: number;

    @ApiProperty({
        type: [AsignacionRutaResultDto],
        description: 'Lista de asignaciones exitosas'
    })
    asignaciones_exitosas: AsignacionRutaResultDto[];

    @ApiProperty({
        type: [AsignacionRutaResultDto],
        description: 'Lista de asignaciones con errores'
    })
    errores: AsignacionRutaResultDto[];
}

/**
 * DTO para consultar asignaciones por fecha
 */
export class ConsultarAsignacionesDto {
    @ApiProperty({
        example: '2026-01-15',
        description: 'Fecha para consultar asignaciones (formato: YYYY-MM-DD)',
        required: false
    })
    @IsDateString()
    @IsOptional()
    fecha?: string;

    @ApiProperty({
        example: 5,
        description: 'ID del supervisor para filtrar',
        required: false
    })
    @IsInt()
    @IsOptional()
    @Transform(({ value }) => parseInt(value))
    supervisor_id?: number;

    @ApiProperty({
        example: true,
        description: 'Filtrar solo asignaciones activas',
        required: false,
        default: true
    })
    @IsBoolean()
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    solo_activas?: boolean;
}
