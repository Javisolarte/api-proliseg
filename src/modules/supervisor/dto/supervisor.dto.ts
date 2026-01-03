import { IsInt, IsString, IsNumber, IsOptional, IsEnum, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegistrarGpsDto {
    @ApiProperty({ example: 4.6097 })
    @IsNumber()
    latitud: number;

    @ApiProperty({ example: -74.0817 })
    @IsNumber()
    longitud: number;

    @ApiProperty({ required: false, example: 10.5 })
    @IsNumber()
    @IsOptional()
    precision?: number;

    @ApiProperty({ required: false, example: 50.0 })
    @IsNumber()
    @IsOptional()
    velocidad?: number;
}

export class IniciarRutaDto {
    @ApiProperty({ description: 'ID de la asignación de ruta (obtenida de /perfil o /ruta-actual)' })
    @IsInt()
    ruta_asignacion_id: number;
}

export class FinalizarRutaDto {
    @ApiProperty({ description: 'ID de la ejecución de ruta' })
    @IsInt()
    ejecucion_id: number;
}

export class IniciarVisitaDto {
    @ApiProperty()
    @IsInt()
    ejecucion_id: number;

    @ApiProperty()
    @IsInt()
    puesto_id: number;

    @ApiProperty()
    @IsNumber()
    latitud: number;

    @ApiProperty()
    @IsNumber()
    longitud: number;
}

export class FinalizarVisitaDto {
    @ApiProperty()
    @IsInt()
    visita_id: number; // ID del evento de 'llegada' que inició la visita, o ID propio si creamos tabla visitas

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    observaciones?: string;
}

export class RegistrarChequeoDto {
    @ApiProperty()
    @IsInt()
    visita_id: number; // Para vincular

    @ApiProperty()
    @IsInt()
    tipo_chequeo_id: number;

    @ApiProperty()
    @IsString()
    resultado: string; // 'ok', 'novedad', etc.

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    novedades?: string;
}

export class RegistrarMinutaDto {
    @ApiProperty()
    @IsInt()
    visita_id: number;

    @ApiProperty()
    @IsString()
    observaciones: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    estado_servicio?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    recomendaciones?: string;
}

export class CargarEvidenciaDto {
    // Entradas para el controller, el archivo va por Multer
    @ApiProperty({ description: 'ID del chequeo o minuta al que pertenece' })
    @IsString() // Multer pasa todo como string en body
    referencia_id: string;

    @ApiProperty({ enum: ['chequeo', 'minuta'] })
    @IsString()
    tipo_origen: string; // 'chequeo' o 'minuta'

    @ApiProperty()
    @IsString()
    supervisor_nombre: string; // Para la carpeta
}
