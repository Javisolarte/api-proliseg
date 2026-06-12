import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, IsArray } from 'class-validator';

export class CreateDispositivoDto {
  @ApiProperty({ example: 'Torniquete Entrada Principal' })
  @IsString()
  @IsNotEmpty()
  nombre_identificador: string;

  @ApiProperty({ example: 1, description: 'ID del puesto de trabajo' })
  @IsNumber()
  @IsNotEmpty()
  puesto_id: number;

  @ApiProperty({ example: '137.131.171.90' })
  @IsString()
  @IsNotEmpty()
  ip_direccion: string;

  @ApiProperty({ example: 'SN-HK-2026-XYZ' })
  @IsString()
  @IsNotEmpty()
  sn_serie: string;

  @ApiProperty({ example: 'operativo', enum: ['operativo', 'falla_conexion', 'mantenimiento', 'desactivado'] })
  @IsString()
  @IsNotEmpty()
  estado: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  perfil_id?: string;
}

export class CreatePersonaAccesoDto {
  @ApiProperty({ example: 'Juan Perez' })
  @IsString()
  @IsNotEmpty()
  nombre_completo: string;

  @ApiProperty({ example: '1085234567' })
  @IsString()
  @IsNotEmpty()
  documento_identidad: string;

  @ApiProperty({ example: 'residente', enum: ['residente', 'empleado', 'contratista'] })
  @IsString()
  @IsOptional()
  entidad_tipo?: string;

  @ApiProperty({ example: 'blanca', enum: ['blanca', 'negra', 'observacion'] })
  @IsString()
  @IsOptional()
  lista_estado?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  entidad_id?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  face_id_ref?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  codigo_tarjeta?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  pin_seguridad?: string;

  @ApiProperty({ required: false, description: 'Foto en base64 o data URL para guardar en biometria_facial' })
  @IsString()
  @IsOptional()
  foto_base64?: string;

  @ApiProperty({ required: false, description: 'IDs de dispositivos a los que tiene acceso' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  dispositivos_ids?: string[];

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  telefono?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  telefono2?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  correo?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  torre?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  apartamento?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  tipo_residente?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  placa_vehiculo?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  color_vehiculo?: string;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  activo?: boolean;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  crear_usuario?: boolean;
}

