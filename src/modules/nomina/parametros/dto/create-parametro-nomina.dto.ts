import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, IsInt, Min, Max } from 'class-validator';

export class CreateParametroNominaDto {
    @ApiProperty({ example: 2024, description: 'Año de vigencia' })
    @IsInt()
    @Min(2000)
    @Max(2100)
    anio: number;

    @ApiProperty({ example: 'hora_extra_diurna', description: 'Tipo de parámetro (clave)' })
    @IsString()
    tipo: string;

    @ApiProperty({ example: 1.25, description: 'Multiplicador o valor' })
    @IsNumber()
    multiplicador: number;

    @ApiProperty({ example: 'Recargo por hora extra diurna', required: false })
    @IsOptional()
    @IsString()
    descripcion?: string;

    @ApiProperty({ example: true, required: false })
    @IsOptional()
    @IsBoolean()
    activo?: boolean;
}
