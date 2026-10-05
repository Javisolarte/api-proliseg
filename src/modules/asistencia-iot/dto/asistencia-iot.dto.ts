import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsNumber, IsArray } from 'class-validator';

export class UpdatePuestoIotConfigDto {
  @IsBoolean()
  @IsNotEmpty()
  iot_activo: boolean;

  @IsOptional()
  @IsString()
  dispositivo_iot_id?: string;

  @IsOptional()
  @IsNumber()
  tolerancia_minutos?: number;
}

export class CreateHorarioDto {
  @IsString()
  @IsNotEmpty()
  nombre_horario: string;

  @IsString()
  @IsNotEmpty()
  hora_entrada: string; // HH:mm:ss

  @IsString()
  @IsNotEmpty()
  hora_salida: string; // HH:mm:ss

  @IsOptional()
  @IsBoolean()
  es_jornada_partida?: boolean;

  @IsOptional()
  @IsString()
  hora_entrada_2?: string; // HH:mm:ss (ej: 14:00:00)

  @IsOptional()
  @IsString()
  hora_salida_2?: string; // HH:mm:ss (ej: 18:00:00)

  @IsOptional()
  @IsNumber()
  tolerancia_entrada_minutos?: number;

  @IsOptional()
  @IsNumber()
  tolerancia_salida_minutos?: number;

  @IsOptional()
  @IsArray()
  dias_semana?: number[];

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class CreateEnlaceDto {
  @IsString()
  @IsNotEmpty()
  nombre_enlace: string;

  @IsOptional()
  @IsNumber()
  horario_id?: number;

  @IsOptional()
  @IsString()
  codigo_seguridad?: string;
}

export class RegistroPublicoPersonalDto {
  @IsString()
  @IsNotEmpty()
  nombre_completo: string;

  @IsString()
  @IsNotEmpty()
  cedula: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsString()
  correo?: string;

  @IsOptional()
  @IsString()
  cargo?: string;

  @IsOptional()
  @IsString()
  foto_base64?: string;

  @IsOptional()
  @IsNumber()
  horario_id?: number;

  @IsOptional()
  @IsString()
  codigo_seguridad?: string;
}

export class CreatePersonalManualDto {
  @IsString()
  @IsNotEmpty()
  nombre_completo: string;

  @IsString()
  @IsNotEmpty()
  cedula: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsString()
  correo?: string;

  @IsOptional()
  @IsString()
  cargo?: string;

  @IsOptional()
  @IsString()
  foto_rostro_url?: string;

  @IsOptional()
  @IsNumber()
  horario_id?: number;
}

export class ProcesarMarcacionManualDto {
  @IsNumber()
  @IsNotEmpty()
  personal_id: number;

  @IsString()
  @IsNotEmpty()
  tipo: 'entrada' | 'salida';

  @IsOptional()
  @IsString()
  hora?: string; // ISO string

  @IsOptional()
  @IsString()
  observacion?: string;
}
