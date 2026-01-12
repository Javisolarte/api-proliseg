import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePruebaDto {
    @ApiProperty({ description: 'Nombre de la prueba técnica o psicotécnica', example: 'Prueba de Seguridad Física - Nivel 1' })
    @IsString()
    @IsNotEmpty()
    nombre: string;

    @ApiPropertyOptional({ description: 'Descripción detallada de la prueba', example: 'Evaluación de conocimientos básicos en control de accesos y minutas.' })
    @IsString()
    @IsOptional()
    descripcion?: string;

    @ApiProperty({ description: 'Tiempo límite en minutos para resolver la prueba', example: 45 })
    @IsInt()
    @Min(1)
    tiempo_minutos: number;

    @ApiProperty({ description: 'Puntaje mínimo requerido para aprobar (0-100)', example: 70 })
    @IsNumber()
    @Min(0)
    @Max(100)
    puntaje_minimo: number;

    @ApiPropertyOptional({ description: 'Indica si la prueba está activa para ser programada', default: true })
    @IsBoolean()
    @IsOptional()
    activa?: boolean;

    @ApiPropertyOptional({ description: 'ID del usuario que crea la prueba', example: 1 })
    @IsInt()
    @IsOptional()
    creada_por?: number;
}
