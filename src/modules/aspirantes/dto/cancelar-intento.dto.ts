import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CancelarIntentoDto {
    @ApiProperty({ description: 'Motivo de la cancelación', example: 'Sospecha de fraude' })
    @IsString()
    @IsNotEmpty()
    motivo: string;
}
