import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, IsIn } from 'class-validator';

export class CreateDeduccionNominaDto {
    @ApiProperty({ example: 'Salud', description: 'Nombre de la deducción' })
    @IsString()
    nombre: string;

    @ApiProperty({ example: 'porcentaje', description: 'Tipo: porcentaje o valor_fijo' })
    @IsString()
    @IsIn(['porcentaje', 'valor_fijo'])
    tipo: string;

    @ApiProperty({ example: 4.0, description: 'Valor de la deducción' })
    @IsNumber()
    valor: number;

    @ApiProperty({ example: 'salario', description: 'Aplica a: salario o devengado_total' })
    @IsString()
    @IsIn(['salario', 'devengado_total'])
    aplica_a: string;

    @ApiProperty({ example: true, required: false })
    @IsOptional()
    @IsBoolean()
    activo?: boolean;
}
