import { ApiProperty } from '@nestjs/swagger';

export class CreateDispositivoDto {
  @ApiProperty({ example: 'Torniquete Entrada Principal' })
  nombre_identificador: string;

  @ApiProperty({ example: 1, description: 'ID del puesto de trabajo' })
  puesto_id: number;

  @ApiProperty({ example: '137.131.171.90' })
  ip_direccion: string;

  @ApiProperty({ example: 'SN-HK-2026-XYZ' })
  sn_serie: string;

  @ApiProperty({ example: 'operativo', enum: ['operativo', 'falla_conexion', 'mantenimiento', 'desactivado'] })
  estado: string;

  @ApiProperty({ required: false })
  perfil_id?: string;
}

export class CreatePersonaAccesoDto {
  @ApiProperty({ example: 'Juan Perez' })
  nombre_completo: string;

  @ApiProperty({ example: '1085234567' })
  documento_identidad: string;

  @ApiProperty({ example: 'residente', enum: ['residente', 'empleado', 'contratista'] })
  entidad_tipo: string;

  @ApiProperty({ example: 'blanca', enum: ['blanca', 'negra', 'observacion'] })
  lista_estado: string;

  @ApiProperty({ required: false })
  codigo_tarjeta?: string;

  @ApiProperty({ required: false, description: 'IDs de dispositivos a los que tiene acceso' })
  dispositivos_ids?: string[];
}
