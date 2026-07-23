import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum DictamenPsicologico {
    APTO = 'APTO',
    NO_APTO = 'NO APTO'
}

export class EvaluatePsicotecnicaDto {
    @ApiProperty({ enum: DictamenPsicologico, example: 'APTO', description: 'Dictamen final de la prueba psicotécnica' })
    @IsEnum(DictamenPsicologico)
    @IsNotEmpty()
    dictamen: DictamenPsicologico;

    @ApiPropertyOptional({ description: 'Observaciones y conclusiones del psicólogo(a)', example: 'Candidato apto para el cargo. Buen control emocional.' })
    @IsString()
    @IsOptional()
    observaciones?: string;

    @ApiPropertyOptional({ description: 'Firma en formato base64 o URL', example: 'data:image/png;base64,...' })
    @IsString()
    @IsOptional()
    firma_base64?: string;
}
