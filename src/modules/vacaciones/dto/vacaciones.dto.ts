import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, IsBoolean, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum VacationStatus {
  PENDIENTE = 'pendiente',
  DISFRUTADA = 'disfrutada',
  CANCELADA = 'cancelada',
  PAGADA = 'pagada',
}

export class CreateVacacionDto {
  @ApiProperty()
  @IsInt()
  @IsNotEmpty()
  empleado_id: number;

  @ApiProperty()
  @IsDateString()
  @IsNotEmpty()
  fecha_inicio: string;

  @ApiProperty()
  @IsDateString()
  @IsNotEmpty()
  fecha_fin: string;

  @ApiProperty()
  @IsDateString()
  @IsNotEmpty()
  fecha_retorno: string;

  @ApiProperty({ enum: VacationStatus, default: VacationStatus.PENDIENTE })
  @IsEnum(VacationStatus)
  @IsOptional()
  estado?: VacationStatus;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  pagadas_sin_disfrutar?: boolean;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  observaciones?: string;
}

export class UpdateVacacionDto extends CreateVacacionDto {}
