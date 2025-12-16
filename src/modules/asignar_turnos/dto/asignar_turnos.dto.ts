import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsDateString } from 'class-validator';

export class AsignarTurnosDto {
  @ApiProperty({
    example: 5,
    description: 'ID del subpuesto para el cual se generarán los turnos. El subpuesto debe tener configuración de turnos asignada.'
  })
  @IsNumber()
  subpuesto_id: number;

  @ApiProperty({
    example: '2025-01-01',
    description: 'Fecha de inicio para la generación de turnos (formato YYYY-MM-DD)'
  })
  @IsDateString()
  fecha_inicio: string;

  @ApiProperty({
    example: 1,
    description: 'ID del usuario que realiza la asignación de turnos'
  })
  @IsNumber()
  asignado_por: number;
}
