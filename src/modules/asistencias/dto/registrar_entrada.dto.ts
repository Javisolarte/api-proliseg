import { IsNotEmpty, IsNumber, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegistrarEntradaDto {
  @ApiProperty({ example: 1, description: 'ID del empleado que registra asistencia' })
  @IsNotEmpty()
  @IsNumber()
  empleado_id: number;

  @ApiProperty({ example: 10, description: 'ID del turno asignado' })
  @IsNotEmpty()
  @IsNumber()
  turno_id: number;

  @ApiProperty({ example: '3.4516', description: 'Latitud GPS' })
  @IsNotEmpty()
  @IsString()
  latitud: string;

  @ApiProperty({ example: '-76.5320', description: 'Longitud GPS' })
  @IsNotEmpty()
  @IsString()
  longitud: string;

  @ApiProperty({ example: 'Llegada tarde por tráfico', description: 'Observación opcional', required: false })
  @IsOptional()
  @IsString()
  observaciones?: string;
}
