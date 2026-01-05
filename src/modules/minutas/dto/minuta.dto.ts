import { ApiProperty, PartialType } from "@nestjs/swagger"
import { IsInt, IsString, IsOptional, IsBoolean, IsDateString, IsNumber, IsArray } from "class-validator"
import { Transform } from "class-transformer"

export class CreateMinutaDto {
  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  turno_id?: number

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  puesto_id?: number

  @ApiProperty({ example: "Todo en orden durante el turno. Sin novedades." })
  @IsString()
  contenido: string

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  visible_para_cliente?: boolean

  @ApiProperty({ example: "2023-10-27", required: false })
  @IsOptional()
  @IsDateString()
  fecha?: string

  @ApiProperty({ example: "08:00:00", required: false })
  @IsOptional()
  @IsString()
  hora?: string

  @ApiProperty({ example: "ronda", required: false })
  @IsOptional()
  @IsString()
  tipo?: string

  @ApiProperty({ example: "Descripción detallada", required: false })
  @IsOptional()
  @IsString()
  descripcion?: string

  @ApiProperty({ example: ['https://example.com/foto1.jpg'], required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fotos?: string[]

  @ApiProperty({ example: 4.6097, required: false })
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseFloat(value))
  ubicacion_lat?: number

  @ApiProperty({ example: -74.0817, required: false })
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseFloat(value))
  ubicacion_lng?: number

  @ApiProperty({ example: "base64_string", required: false })
  @IsOptional()
  @IsString()
  firma_guardia?: string

  @ApiProperty({ example: "base64_string", required: false })
  @IsOptional()
  @IsString()
  firma_supervisor?: string

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  validado?: boolean

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  validado_por?: number

  @ApiProperty({ example: "2023-10-27T10:00:00Z", required: false })
  @IsOptional()
  @IsDateString()
  fecha_validacion?: string

  @ApiProperty({ example: "novedad", required: false })
  @IsOptional()
  @IsString()
  tipo_novedad?: string

  @ApiProperty({ example: "Título de la minuta", required: false })
  @IsOptional()
  @IsString()
  titulo?: string

  @ApiProperty({ example: "general", required: false })
  @IsOptional()
  @IsString()
  categoria?: string

  @ApiProperty({ example: "bajo", required: false })
  @IsOptional()
  @IsString()
  nivel_riesgo?: string

  @ApiProperty({ example: ['https://example.com/video1.mp4'], required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  videos?: string[]

  @ApiProperty({ example: ['https://example.com/doc1.pdf'], required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  adjuntos?: string[]

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  turno_entrante?: number

  @ApiProperty({ example: 2, required: false })
  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  turno_saliente?: number

  @ApiProperty({ example: [], required: false })
  @IsOptional()
  @IsArray()
  inventario_entregado?: any[]

  @ApiProperty({ example: "Observaciones del cambio de turno", required: false })
  @IsOptional()
  @IsString()
  observaciones_cambio?: string

  @ApiProperty({ example: "192.168.1.1", required: false })
  @IsOptional()
  @IsString()
  ip_origen?: string

  @ApiProperty({ example: "Android 12", required: false })
  @IsOptional()
  @IsString()
  dispositivo?: string

  @ApiProperty({ example: "1.0.0", required: false })
  @IsOptional()
  @IsString()
  version_app?: string

  @ApiProperty({ example: "activo", required: false })
  @IsOptional()
  @IsString()
  estado?: string
}

export class UpdateMinutaDto extends PartialType(CreateMinutaDto) { }

export class UploadMinutaAdjuntosDto {
  @ApiProperty({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: 'Archivos a subir (Imágenes, Videos, PDFs). Máximo 5 archivos.'
  })
  files: any[];
}
