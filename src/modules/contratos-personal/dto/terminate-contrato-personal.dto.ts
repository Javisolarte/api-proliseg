import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class TerminateContratoPersonalDto {
    @ApiProperty({ description: 'ID del contrato a terminar', example: 1 })
    @IsInt()
    @Transform(({ value }) => parseInt(value))
    contrato_id: number;

    @ApiProperty({ description: 'Fecha de terminación (YYYY-MM-DD)', example: '2023-06-30' })
    @IsDateString()
    fecha_terminacion: string;

    @ApiProperty({ description: 'Motivo de terminación', example: 'Renuncia voluntaria' })
    @IsString()
    motivo_terminacion: string;

    @ApiProperty({ type: 'string', format: 'binary', required: false, description: 'PDF de terminación/liquidación' })
    @IsOptional()
    terminacion_pdf?: any;
}
