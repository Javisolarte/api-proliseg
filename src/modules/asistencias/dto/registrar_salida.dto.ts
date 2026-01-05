import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, IsOptional } from 'class-validator';

export class RegistrarSalidaDto {
  @ApiProperty({ example: 12, description: 'ID de la asistencia (registro de entrada previo)' })
  @IsNotEmpty()
  @IsNumber()
  asistencia_id: number;

  @ApiProperty({ example: 5, description: 'ID del turno' })
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

  @ApiProperty({ required: false, example: 'Salida normal' })
  @IsOptional()
  @IsString()
  observacion?: string;
}
