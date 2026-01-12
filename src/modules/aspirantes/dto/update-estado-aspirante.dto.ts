import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateEstadoAspiranteDto {
    @ApiProperty({
        description: 'Nuevo estado del aspirante',
        enum: ['nuevo', 'en_proceso', 'aprobado', 'no_apto', 'descartado', 'contratado'],
        example: 'aprobado'
    })
    @IsString()
    @IsNotEmpty()
    @IsIn(['nuevo', 'en_proceso', 'aprobado', 'no_apto', 'descartado', 'contratado'])
    estado: string;

    @ApiPropertyOptional({ description: 'Observaciones sobre el cambio de estado' })
    @IsString()
    @IsOptional()
    observacion?: string;
}
