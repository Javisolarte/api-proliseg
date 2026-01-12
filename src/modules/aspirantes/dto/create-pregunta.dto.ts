import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOpcionDto {
    @ApiProperty({ description: 'Texto de la opción de respuesta', example: 'El libro de minutas' })
    @IsString()
    @IsNotEmpty()
    texto: string;

    @ApiProperty({ description: 'Indica si es la opción correcta. Solo una debe ser true por pregunta.', default: false })
    @IsBoolean()
    @IsOptional()
    es_correcta?: boolean;

    @ApiPropertyOptional({ description: 'Orden de visualización de la opción', example: 1 })
    @IsInt()
    @IsOptional()
    orden?: number;
}

export class CreatePreguntaDto {
    @ApiProperty({ description: 'ID de la prueba a la que pertenece', example: 10 })
    @IsInt()
    @IsNotEmpty()
    prueba_id: number;

    @ApiProperty({ description: 'Texto de la pregunta', example: '¿Cuál es el documento principal para registrar novedades en el puesto?' })
    @IsString()
    @IsNotEmpty()
    pregunta: string;

    @ApiPropertyOptional({ description: 'Explicación que se mostrará al usuario si falla la respuesta', example: 'El libro de minutas es el documento oficial y legal...' })
    @IsString()
    @IsOptional()
    retroalimentacion?: string;

    @ApiPropertyOptional({ description: 'Orden de la pregunta en la prueba', example: 1 })
    @IsInt()
    @IsOptional()
    orden?: number;

    @ApiProperty({ description: 'Lista de opciones de respuesta', type: [CreateOpcionDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateOpcionDto)
    opciones: CreateOpcionDto[];
}
