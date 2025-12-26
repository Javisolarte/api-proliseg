import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional } from 'class-validator';

export class CreateHorasNominaDto {
    @ApiProperty({ example: 1, description: 'ID del empleado' })
    @IsInt()
    empleado_id: number;

    @ApiProperty({ example: 1, description: 'ID del periodo de nomina' })
    @IsInt()
    periodo_id: number;

    @ApiProperty({ example: 5, description: 'Horas Extras Diurnas', required: false })
    @IsOptional()
    @IsNumber()
    cantidad_hed?: number;

    @ApiProperty({ example: 2, description: 'Horas Extras Nocturnas', required: false })
    @IsOptional()
    @IsNumber()
    cantidad_hen?: number;

    @ApiProperty({ example: 0, description: 'Horas Extras Festivas Diurnas', required: false })
    @IsOptional()
    @IsNumber()
    cantidad_hefd?: number;

    @ApiProperty({ example: 0, description: 'Horas Extras Festivas Nocturnas', required: false })
    @IsOptional()
    @IsNumber()
    cantidad_hefn?: number;

    @ApiProperty({ example: 0, description: 'Recargo Nocturno', required: false })
    @IsOptional()
    @IsNumber()
    cantidad_rn?: number;

    @ApiProperty({ example: 0, description: 'Recargo Festivo Diurno', required: false })
    @IsOptional()
    @IsNumber()
    cantidad_rfd?: number;

    @ApiProperty({ example: 0, description: 'Recargo Festivo Nocturno', required: false })
    @IsOptional()
    @IsNumber()
    cantidad_rfn?: number;
}
