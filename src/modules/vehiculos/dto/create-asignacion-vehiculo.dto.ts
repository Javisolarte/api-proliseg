import { IsInt, IsDateString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAsignacionVehiculoDto {
    @ApiProperty({ example: 1, description: 'ID del supervisor (empleado)' })
    @IsInt()
    supervisor_id: number;

    @ApiProperty({ example: 1, description: 'ID del vehículo' })
    @IsInt()
    vehiculo_id: number;

    @ApiProperty({ example: '2024-01-01', description: 'Fecha de asignación' })
    @IsDateString()
    @IsOptional()
    fecha_asignacion?: string;

    @ApiProperty({ example: true, description: 'Si la asignación está activa' })
    @IsBoolean()
    @IsOptional()
    activo?: boolean;
}
