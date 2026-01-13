import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsArray,
  IsOptional,
  MinLength,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// =========================================================
// 🧠 DTO 1: CONSULTAS EN LENGUAJE NATURAL → SQL
// =========================================================
export class ChatMessageDto {
  @ApiProperty({ example: 'user', enum: ['user', 'assistant'] })
  @IsString()
  role: 'user' | 'assistant';

  @ApiProperty({ example: '¿Quién es el más viejo?' })
  @IsString()
  content: string;
}

export class IaDto {
  @ApiProperty({
    example: 'Muéstrame todos los empleados activos',
    description: 'Consulta en lenguaje natural que se convertirá en SQL.',
  })
  @IsString()
  @MinLength(3)
  query: string;

  @ApiPropertyOptional({
    type: [ChatMessageDto],
    description: 'Historial de la conversación para mantener el contexto.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  history?: ChatMessageDto[];
}

// =========================================================
// 🔮 DTO 2: PREDICCIONES / ANÁLISIS (sin datos extra)
// =========================================================
export class IaPrediccionDto {
  @ApiPropertyOptional({
    example: 'Predice ausencias o incidentes próximos',
    description:
      'Consulta opcional para guiar el análisis de predicciones con IA.',
  })
  @IsOptional()
  @IsString()
  consulta?: string;
}

// =========================================================
// ⚙️ DTO 3: REENTRENAMIENTO ADAPTATIVO
// =========================================================
export class IaReentrenamientoDto {
  @ApiProperty({
    example: [
      {
        empleado_id: 12,
        puntualidad: 95,
        asistencias: 28,
        sanciones: 0,
        mes: '2025-09',
      },
    ],
    description:
      'Nuevos registros de desempeño para actualizar el modelo adaptativo.',
  })
  @IsArray()
  @IsObject({ each: true })
  nuevos_datos: Record<string, any>[];
}

// =========================================================
// 🚔 DTO 4: RUTAS INTELIGENTES DE PATRULLAJE
// =========================================================
export class PuntoGPS {
  @ApiProperty({ example: 1, description: 'ID o nombre del punto.' })
  @IsString()
  id: string;

  @ApiProperty({ example: 4.652, description: 'Latitud del punto GPS.' })
  lat: number;

  @ApiProperty({ example: -74.083, description: 'Longitud del punto GPS.' })
  lng: number;

  @ApiPropertyOptional({
    example: 'Entrada principal del condominio Fátima',
    description: 'Descripción del punto o subpunto.',
  })
  @IsOptional()
  @IsString()
  descripcion?: string;
}

export class IaRutasDto {
  @ApiProperty({
    type: [PuntoGPS],
    description:
      'Lista de puntos GPS para generar la ruta óptima de patrullaje.',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PuntoGPS)
  puntos: PuntoGPS[];
}

// =========================================================
// 📹 DTO 5: DETECCIÓN DE COMPORTAMIENTOS ANÓMALOS
// =========================================================
export class IaAnomaliaDto {
  @ApiPropertyOptional({
    example: 'Analiza los eventos recientes de cámaras y sensores.',
    description: 'Texto opcional para guiar el análisis de anomalías.',
  })
  @IsOptional()
  @IsString()
  descripcion?: string;
}
