import { IsInt, IsString, IsUrl, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateEvidenciaDto {
    @ApiProperty({ example: 1, description: 'ID de la minuta/chequeo (minutas_rutas)' })
    @IsInt()
    minuta_id: number;

    @ApiProperty({ example: 'foto', enum: ['foto', 'audio', 'documento'] })
    @IsEnum(['foto', 'audio', 'documento'])
    tipo: string;

    @ApiProperty({ example: 'https://storage.com/foto1.jpg' })
    @IsUrl()
    url: string;
}
