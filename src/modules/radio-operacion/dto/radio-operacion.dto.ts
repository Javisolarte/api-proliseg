import { IsNotEmpty, IsOptional, IsNumber, IsString, IsBoolean, IsIn, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ========== RADIO OPERADORES ==========

export class CreateRadioOperadorDto {
  @ApiProperty({ example: 1, description: 'ID del empleado asociado' })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  empleado_id: number;

  @ApiPropertyOptional({ example: 'RO-001', description: 'Código de radio del operador' })
  @IsOptional()
  @IsString()
  codigo_radio?: string;

  @ApiPropertyOptional({ example: 'dia', enum: ['dia', 'noche', 'rotativo'] })
  @IsOptional()
  @IsString()
  @IsIn(['dia', 'noche', 'rotativo'])
  turno_habitual?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  activo?: boolean;

  @ApiPropertyOptional({ example: 'Operador principal turno noche' })
  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class UpdateRadioOperadorDto extends PartialType(CreateRadioOperadorDto) {}

// ========== REPORTES PUESTOS OPERATIVOS ==========

export class CreateReporteDto {
  @ApiProperty({ example: 1, description: 'ID del radio operador que crea el reporte' })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  radio_operador_id: number;

  @ApiPropertyOptional({ example: 'Carlos Pérez', description: 'Nombre del supervisor de turno' })
  @IsOptional()
  @IsString()
  supervisor_turno?: string;

  @ApiProperty({ example: '2026-04-15', description: 'Fecha del reporte' })
  @IsNotEmpty()
  @IsDateString()
  fecha: string;

  @ApiProperty({ example: 'dia', enum: ['dia', 'noche'], description: 'Turno del reporte' })
  @IsNotEmpty()
  @IsString()
  @IsIn(['dia', 'noche'])
  turno: string;

  @ApiProperty({ example: 1, enum: [1, 2, 3], description: 'Frecuencia en horas para chequeo' })
  @IsNotEmpty()
  @IsNumber()
  @IsIn([1, 2, 3])
  @Type(() => Number)
  frecuencia_horas: number;

  @ApiPropertyOptional({ description: 'Lista de puestos con sus guardas' })
  @IsOptional()
  puestos?: CreateReporteDetalleDto[];

  @ApiPropertyOptional({ example: 'Sin observaciones' })
  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class UpdateReporteDto extends PartialType(CreateReporteDto) {
  @ApiPropertyOptional({ description: 'Firma digital del radio operador (Base64)' })
  @IsOptional()
  @IsString()
  firma_operador?: string;

  @ApiPropertyOptional({ description: 'Fecha de aprobación del formato' })
  @IsOptional()
  @IsString()
  fecha_aprobacion?: string;

  @ApiPropertyOptional({ description: 'Versión del formato' })
  @IsOptional()
  @IsString()
  version_formato?: string;
}

export class CreateReporteDetalleDto {
  @ApiProperty({ example: 1 })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  puesto_id: number;

  @ApiPropertyOptional({ example: '1002' })
  @IsOptional()
  @IsString()
  codigo_puesto?: string;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  empleado_id?: number;

  @ApiPropertyOptional({ example: 'Lindsay Rojas' })
  @IsOptional()
  @IsString()
  nombre_guarda?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  cambio_turno?: boolean;

  @ApiPropertyOptional({ example: ' Lindsay Rojas' })
  @IsOptional()
  @IsString()
  relevo_nombre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observaciones?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  orden?: number;
}

// ========== CHEQUEO ==========

export class MarcarChequeoDto {
  @ApiProperty({ example: 1, description: 'ID del chequeo a marcar' })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  chequeo_id: number;

  @ApiProperty({ example: 'sin_novedad', enum: ['sin_novedad', 'novedad', 'no_contesta', 'pendiente'] })
  @IsNotEmpty()
  @IsString()
  @IsIn(['sin_novedad', 'novedad', 'no_contesta', 'pendiente'])
  estado: string;

  @ApiPropertyOptional({ example: 'Todo en orden' })
  @IsOptional()
  @IsString()
  nota?: string;
}

export class MarcarChequeosBulkDto {
  @ApiProperty({ description: 'Lista de chequeos a marcar' })
  @IsNotEmpty()
  chequeos: MarcarChequeoDto[];
}
