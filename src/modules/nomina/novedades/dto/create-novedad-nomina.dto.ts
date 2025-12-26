import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateNovedadNominaDto {
    @ApiProperty({ example: 10, description: 'ID del empleado' })
    @IsInt()
    empleado_id: number;

    @ApiProperty({ example: 15, description: 'ID del periodo de nomina' })
    @IsInt()
    periodo_id: number;

    @ApiProperty({ example: 'incapacidad_general', description: 'Tipo de novedad' })
    @IsString()
    tipo: string;

    @ApiProperty({ example: '2024-05-10', description: 'Fecha inicio' })
    @IsDateString()
    fecha_inicio: string;

    @ApiProperty({ example: '2024-05-12', description: 'Fecha fin' })
    @IsDateString()
    fecha_fin: string;

    @ApiProperty({ example: 3, description: 'Cantidad de dias' })
    @IsInt()
    @Min(0)
    dias: number;

    @ApiProperty({ example: 'Gripe', description: 'Observacion opcional', required: false })
    @IsOptional()
    @IsString()
    observacion?: string;
}
