import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class RegistrarEntradaDto {
  @IsNotEmpty()
  @IsNumber()
  empleado_id: number;

  @IsNotEmpty()
  @IsNumber()
  turno_id: number;

  @IsNotEmpty()
  @IsString()
  latitud: string;

  @IsNotEmpty()
  @IsString()
  longitud: string;

  @IsString()
  observacion?: string;
}
