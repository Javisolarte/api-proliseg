import { IsString, IsOptional, IsBoolean, IsNumber, IsEnum } from 'class-validator';

export class CreateCredencialDto {
  @IsString()
  nombre_dispositivo: string;

  @IsOptional()
  @IsString()
  tipo_dispositivo?: string;

  @IsOptional()
  @IsString()
  marca?: string;

  @IsOptional()
  @IsString()
  modelo?: string;

  @IsOptional()
  @IsString()
  numero_serie?: string;

  @IsOptional()
  @IsString()
  direccion_ip?: string;

  @IsOptional()
  @IsString()
  puerto?: string;

  @IsOptional()
  @IsString()
  url_acceso?: string;

  @IsOptional()
  @IsBoolean()
  asignado?: boolean;

  @IsOptional()
  @IsString()
  puesto_asignado?: string;

  @IsOptional()
  @IsNumber()
  puesto_id?: number;

  @IsOptional()
  @IsString()
  cuenta_usuario?: string;

  @IsOptional()
  @IsString()
  cuenta_correo?: string;

  @IsOptional()
  @IsString()
  contrasena?: string;

  @IsOptional()
  @IsString()
  patron_acceso?: string;

  @IsOptional()
  @IsString()
  pin_acceso?: string;

  @IsOptional()
  @IsString()
  notas?: string;

  @IsOptional()
  @IsString()
  estado?: string;
}

export class UpdateCredencialDto extends CreateCredencialDto {
  @IsOptional()
  @IsString()
  motivo_cambio?: string;
}
