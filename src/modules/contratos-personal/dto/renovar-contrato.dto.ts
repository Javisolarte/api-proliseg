import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString } from 'class-validator';

export class RenovarContratoDto {
    @ApiProperty({ example: 1, description: 'ID del contrato anterior a renovar' })
    @IsInt()
    contrato_anterior_id: number;

    @ApiProperty({ example: 'termino_fijo', description: 'Nuevo tipo de contrato' })
    @IsString()
    tipo_contrato: string;

    @ApiProperty({ example: '2025-01-01', description: 'Nueva fecha de inicio' })
    @IsDateString()
    fecha_inicio: string;

    @ApiProperty({ example: '2026-01-01', required: false })
    @IsOptional()
    @IsDateString()
    fecha_fin?: string;

    @ApiProperty({ example: 2, description: 'ID del nuevo salario' })
    @IsInt()
    salario_id: number;
}
