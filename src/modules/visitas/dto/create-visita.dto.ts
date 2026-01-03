import { IsInt, IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

// --- Visitas (Llegada al puesto) ---
export class CreateVisitaDto {
    @ApiProperty({ example: 1, description: 'ID de la ejecución de ruta' })
    @IsInt()
    ejecucion_id: number;

    @ApiProperty({ example: 1, description: 'ID del puesto visitado' })
    @IsInt()
    puesto_id: number;

    @ApiProperty({ example: 4.6097 })
    @IsNumber()
    latitud: number;

    @ApiProperty({ example: -74.0817 })
    @IsNumber()
    longitud: number;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    observacion?: string;
}

// --- Tipos de Chequeo (Configuración) ---
export class CreateTipoChequeoDto {
    @ApiProperty({ example: 'Armamento' })
    @IsString()
    nombre: string;

    @ApiProperty({ example: 'Verificación de armas y munición' })
    @IsString()
    @IsOptional()
    descripcion?: string;

    @ApiProperty({ example: true })
    @IsBoolean()
    @IsOptional()
    activo?: boolean;
}

export class UpdateTipoChequeoDto extends PartialType(CreateTipoChequeoDto) { }

// --- Chequeos Realizados (Minuta de ruta) ---
export class CreateChequeoDto {
    // NOTA: El esquema llama "minutas_rutas" a la tabla que vincula Ejecucion + Puesto + Tipo Chequeo.
    // Esto parece ser el "Checkeo Realizado".
    // "Cada vez que un supervisor visita un puesto... debe seleccionar un tipo de checkeo".

    @ApiProperty({ example: 1, description: 'ID de la ejecución' })
    @IsInt()
    ejecucion_id: number;

    @ApiProperty({ example: 1, description: 'ID del puesto' })
    @IsInt()
    puesto_id: number;

    @ApiProperty({ example: 1, description: 'ID del supervisor' })
    @IsInt()
    supervisor_id: number;

    @ApiProperty({ example: 1, description: 'ID del tipo de chequeo' })
    @IsInt()
    tipo_chequeo_id: number;

    @ApiProperty({ example: 'Todo en orden' })
    @IsString()
    detalle_operativo: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    novedades?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    mejoras_sugeridas?: string;
}
