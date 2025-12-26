import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';

export class CreatePeriodoDto {
    @ApiProperty({ example: 2024, description: 'Año del periodo' })
    @IsInt()
    @Min(2000)
    @Max(2100)
    anio: number;

    @ApiProperty({ example: 5, description: 'Mes del periodo (1-12)' })
    @IsInt()
    @Min(1)
    @Max(12)
    mes: number;

    @ApiProperty({ example: '2024-05-01', description: 'Fecha inicio del periodo' })
    @IsDateString()
    fecha_inicio: string;

    @ApiProperty({ example: '2024-05-31', description: 'Fecha fin del periodo' })
    @IsDateString()
    fecha_fin: string;

    @ApiProperty({ example: false, description: 'Estado cerrado inicial', required: false })
    @IsOptional()
    @IsBoolean()
    cerrado?: boolean;
}
