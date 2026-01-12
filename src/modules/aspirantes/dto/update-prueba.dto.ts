import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdatePruebaDto {
    @ApiPropertyOptional({ description: 'Nombre de la prueba', example: 'Prueba Actualizada' })
    @IsString()
    @IsOptional()
    nombre?: string;

    @ApiPropertyOptional({ description: 'Descripción de la prueba' })
    @IsString()
    @IsOptional()
    descripcion?: string;

    @ApiPropertyOptional({ description: 'Tiempo en minutos', example: 60 })
    @IsInt()
    @IsOptional()
    @Min(1)
    tiempo_minutos?: number;

    @ApiPropertyOptional({ description: 'Puntaje mínimo de aprobación (0-100)', example: 75 })
    @IsNumber()
    @IsOptional()
    @Min(0)
    @Max(100)
    puntaje_minimo?: number;

    @ApiPropertyOptional({ description: 'Estado activo/inactivo', example: true })
    @IsBoolean()
    @IsOptional()
    activa?: boolean;
}
