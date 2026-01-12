import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateOpcionDto {
    @ApiPropertyOptional({ description: 'ID de la opción (si existe)' })
    @IsInt()
    @IsOptional()
    id?: number;

    @ApiPropertyOptional({ description: 'Texto de la opción' })
    @IsString()
    @IsOptional()
    texto?: string;

    @ApiPropertyOptional({ description: 'Es la opción correcta' })
    @IsBoolean()
    @IsOptional()
    es_correcta?: boolean;

    @ApiPropertyOptional({ description: 'Orden de visualización' })
    @IsInt()
    @IsOptional()
    orden?: number;
}

export class UpdatePreguntaDto {
    @ApiPropertyOptional({ description: 'Texto de la pregunta' })
    @IsString()
    @IsOptional()
    pregunta?: string;

    @ApiPropertyOptional({ description: 'Retroalimentación para respuesta incorrecta' })
    @IsString()
    @IsOptional()
    retroalimentacion?: string;

    @ApiPropertyOptional({ description: 'Orden de la pregunta en la prueba' })
    @IsInt()
    @IsOptional()
    orden?: number;

    @ApiPropertyOptional({ description: 'Opciones actualizadas', type: [UpdateOpcionDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateOpcionDto)
    @IsOptional()
    opciones?: UpdateOpcionDto[];
}
