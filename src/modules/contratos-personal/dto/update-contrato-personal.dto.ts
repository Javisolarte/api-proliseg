import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { TipoContrato } from './create-contrato-personal.dto';

export class UpdateContratoPersonalDto {
    @ApiProperty({ enum: TipoContrato, required: false })
    @IsOptional()
    @IsEnum(TipoContrato)
    tipo_contrato?: TipoContrato;

    @ApiProperty({ description: 'ID del salario', required: false })
    @IsOptional()
    @IsInt()
    @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
    salario_id?: number;

    @ApiProperty({ description: 'Fecha de inicio (YYYY-MM-DD)', required: false })
    @IsOptional()
    @Transform(({ value }) => (!value || value === 'null' || value === 'undefined' ? null : value))
    @IsDateString()
    fecha_inicio?: string;

    @ApiProperty({ description: 'Fecha de fin (YYYY-MM-DD)', required: false })
    @IsOptional()
    @Transform(({ value }) => (!value || value === 'null' || value === 'undefined' ? null : value))
    @IsDateString()
    fecha_fin?: string;

    @ApiProperty({ description: 'Fecha fin de prueba (YYYY-MM-DD)', required: false })
    @IsOptional()
    @Transform(({ value }) => (!value || value === 'null' || value === 'undefined' ? null : value))
    @IsDateString()
    fecha_fin_prueba?: string;

    @ApiProperty({ example: 'https://url-to-pdf.com', required: false })
    @IsOptional()
    @IsString()
    contrato_pdf_url?: string;

    @ApiProperty({ example: 'https://url-to-termination.com', required: false })
    @IsOptional()
    @IsString()
    terminacion_pdf_url?: string;

    @ApiProperty({ description: 'Estado del contrato', required: false })
    @IsOptional()
    @IsString()
    estado?: string;
}
