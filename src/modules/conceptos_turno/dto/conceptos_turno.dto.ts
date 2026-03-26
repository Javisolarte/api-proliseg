import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsHexColor, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateConceptoTurnoDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  codigo: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  descripcion?: string;

  @ApiProperty({ required: false, default: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  horas_normales?: number;

  @ApiProperty({ required: false, default: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  horas_extras?: number;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  paga_salario?: boolean;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  paga_aux_transporte?: boolean;

  @ApiProperty({ required: false })
  @IsHexColor()
  @IsOptional()
  color?: string;
}

export class UpdateConceptoTurnoDto extends CreateConceptoTurnoDto {
  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}
