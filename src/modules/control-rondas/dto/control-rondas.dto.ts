import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class UpsertConfiguracionRondaDto {
  @ApiProperty()
  @IsInt()
  puesto_id: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiPropertyOptional({ default: 60 })
  @IsOptional()
  @IsInt()
  @Min(1)
  frecuencia_minutos?: number;

  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  duracion_objetivo_minutos?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  requiere_orden?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  requiere_foto_cierre?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  requiere_gps?: boolean;

  @ApiPropertyOptional({ default: 60 })
  @IsOptional()
  @IsInt()
  radio_geocerca_metros?: number;

  @ApiPropertyOptional({ default: "qr_gps_foto_tracking" })
  @IsOptional()
  @IsString()
  modo_antifraude?: string;
}

export class UpsertPuntoControlDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  id?: number;

  @ApiProperty()
  @IsString()
  nombre: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instrucciones?: string;

  @ApiProperty()
  @IsInt()
  orden: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  obligatorio?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  latitud?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  longitud?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  radio_metros?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requiere_foto?: boolean;
}

export class BulkPuntosControlDto {
  @ApiProperty({ type: [UpsertPuntoControlDto] })
  @IsArray()
  puntos: UpsertPuntoControlDto[];
}

export class IniciarRondaControlDto {
  @ApiProperty()
  @IsInt()
  configuracion_id: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  empleado_id?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dispositivo_id?: string;
}

export class RegistrarLecturaControlDto {
  @ApiProperty()
  @IsInt()
  punto_id: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  qr_payload_recibido?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  latitud?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  longitud?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  precision_metros?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  evidencia_foto_url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  evidencia_foto_path?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comentario?: string;
}

export class FinalizarRondaControlDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  evidencia_cierre_url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  evidencia_cierre_path?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  motivo_incompleta?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observaciones?: string;
}
