import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsDateString } from 'class-validator';

export class AsignarTurnosDto {
  @ApiPropertyOptional({ example: 1, description: 'ID del puesto al que se asignan los turnos (opcional si se usa subpuesto)' })
  @IsOptional()
  @IsNumber()
  puesto_id?: number;

  @ApiProperty({ example: 2, description: 'ID de la configuración de turnos a usar' })
  @IsNumber()
  configuracion_id: number;

  @ApiProperty({ example: '2025-10-22', description: 'Fecha de inicio para asignar turnos' })
  @IsDateString()
  fecha_inicio: string;

  @ApiProperty({ example: 1, description: 'ID del usuario que realiza la asignación' })
  @IsNumber()
  asignado_por: number;

  @ApiPropertyOptional({ example: 5, description: 'ID opcional de subpuesto, si aplica' })
  @IsOptional()
  @IsNumber()
  subpuesto_id?: number;
}
