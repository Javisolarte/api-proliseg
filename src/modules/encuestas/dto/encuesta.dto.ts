import { IsString, IsOptional, IsBoolean, IsArray, IsEnum, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class PreguntaDto {
  @IsOptional()
  @IsNumber()
  id?: number;

  @IsOptional()
  @IsNumber()
  orden?: number;

  @IsOptional()
  @IsString()
  dimension?: string;

  @IsString()
  texto_pregunta: string;

  @IsOptional()
  @IsString()
  tipo_pregunta?: string; // 'likert_5', 'single_choice', 'multiple_choice', 'texto_libre', 'booleano'

  @IsOptional()
  @IsArray()
  opciones?: any[];

  @IsOptional()
  respuesta_correcta?: any;

  @IsOptional()
  @IsNumber()
  puntos?: number;

  @IsOptional()
  @IsBoolean()
  es_requerida?: boolean;
}

export class CreateEncuestaDto {
  @IsString()
  titulo: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  tipo?: string; // 'clima_laboral', 'evaluacion_conocimientos', 'seleccion_multiple', 'satisfaccion', 'general'

  @IsOptional()
  @IsBoolean()
  permite_respuestas_anonimas?: boolean;

  @IsOptional()
  @IsBoolean()
  requiere_identificacion?: boolean;

  @IsOptional()
  @IsBoolean()
  mostrar_aviso_privacidad?: boolean;

  @IsOptional()
  @IsString()
  instrucciones?: string;

  @IsOptional()
  @IsString()
  aviso_privacidad?: string;

  @IsOptional()
  @IsString()
  tipo_vigencia?: string; // 'indefinido', 'horas', 'fecha_especifica'

  @IsOptional()
  @IsNumber()
  horas_vigencia?: number;

  @IsOptional()
  @IsString()
  fecha_cierre?: string;

  @IsOptional()
  @IsString()
  estado?: string; // 'borrador', 'activa', 'cerrada'

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreguntaDto)
  preguntas?: PreguntaDto[];
}

export class UpdateEncuestaDto extends CreateEncuestaDto {}

export class RespuestaDetalleDto {
  @IsNumber()
  pregunta_id: number;

  valor_respuesta: any;
}

export class SubmitRespuestaDto {
  @IsOptional()
  @IsString()
  nombre_respondiente?: string;

  @IsOptional()
  @IsString()
  documento_respondiente?: string;

  @IsOptional()
  @IsString()
  cargo_respondiente?: string;

  @IsOptional()
  @IsString()
  sede_area?: string;

  @IsBoolean()
  acepta_tratamiento_datos: boolean;

  @IsOptional()
  @IsNumber()
  duracion_segundos?: number;

  @IsOptional()
  @IsNumber()
  latitud?: number;

  @IsOptional()
  @IsNumber()
  longitud?: number;

  @IsOptional()
  @IsString()
  ubicacion_ciudad?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RespuestaDetalleDto)
  respuestas: RespuestaDetalleDto[];
}
