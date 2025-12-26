import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateContratoPersonalDto {
    @ApiProperty({ example: 'https://url-to-pdf.com', required: false })
    @IsOptional()
    @IsString()
    contrato_pdf_url?: string;

    @ApiProperty({ example: 'https://url-to-termination.com', required: false })
    @IsOptional()
    @IsString()
    terminacion_pdf_url?: string;
}
