import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsNumber,
  IsDateString,
  IsBoolean,
  Min,
  IsString,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateContratoItemDto {
  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsInt()
  contrato_id?: number;

  @ApiProperty({ example: 10, required: false })
  @IsOptional()
  @IsInt()
  tipo_servicio_id?: number;

  @ApiProperty({ example: 'Servicio de vigilancia diurna' })
  @IsString()
  descripcion: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  cantidad: number;

  @ApiProperty({ example: 2500000 })
  @IsNumber()
  valor_unitario: number;

  @ApiProperty({ example: 5000000 })
  @IsNumber()
  total_linea: number;
}

export class CreateContratoDto {
  @ApiProperty({
    example: 1,
    description: 'ID del cliente asociado al contrato',
  })
  @IsInt()
  cliente_id: number;

  @ApiProperty({
    example: 10,
    required: false,
    description:
      'ID del tipo de servicio asociado (tabla tipo_servicio).\nEjemplos: 10=Vigilancia 24/7, 11=Vigilancia diurna, 12=Vigilancia nocturna, 13=Rondas, 14=Reacción motorizada, 15=Escolta ejecutiva, 16=Escolta de carga, 17=Control de acceso, 18=Monitoreo CCTV',
  })
  @IsOptional()
  @IsInt()
  tipo_servicio_id?: number;

  @ApiProperty({
    example: 50000000,
    required: false,
    description: 'Valor total del contrato en pesos colombianos',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  valor?: number;

  @ApiProperty({
    example: 2,
    required: false,
    description: 'Cantidad de personas que deben estar activas simultáneamente para cumplir el servicio. NO representa empleados totales, solo demanda operativa.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  guardas_activos?: number;

  @ApiProperty({
    example: '2025-01-01',
    required: false,
    description: 'Fecha de inicio del contrato (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  fecha_inicio?: string;

  @ApiProperty({
    example: '2025-12-31',
    required: false,
    description: 'Fecha de finalización del contrato (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  fecha_fin?: string;

  @ApiProperty({
    example: true,
    required: false,
    description: 'Estado del contrato (activo/inactivo)',
  })
  @IsOptional()
  @IsBoolean()
  estado?: boolean;

  @ApiProperty({
    example: 1,
    required: false,
    description: 'ID del usuario creador del contrato',
  })
  @IsOptional()
  @IsInt()
  creado_por?: number;

  @ApiProperty({
    example: 'https://...',
    required: false,
    description: 'URL del RUT en storage',
  })
  @IsOptional()
  @IsString()
  rut_url?: string;

  @ApiProperty({
    example: 'https://...',
    required: false,
    description: 'URL de la Cámara de Comercio en storage',
  })
  @IsOptional()
  @IsString()
  camara_comercio_url?: string;

  @ApiProperty({
    example: 'https://...',
    required: false,
    description: 'URL de la Cédula del Representante en storage',
  })
  @IsOptional()
  @IsString()
  cedula_representante_url?: string;

  @ApiProperty({
    example: 'El cliente solicita atención especial los fines de semana.',
    required: false,
    description: 'Observaciones generales del contrato',
  })
  @IsOptional()
  @IsString()
  observaciones?: string;

  @ApiProperty({ type: () => [CreateContratoItemDto], required: false, description: "Items del contrato" })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateContratoItemDto)
  items?: CreateContratoItemDto[];
}

export class UpdateContratoDto extends PartialType(CreateContratoDto) { }

/**
 * DTO de respuesta para guardas requeridos por contrato
 * Basado en la vista vw_guardas_requeridos_contrato
 */
export class GuardasRequeridosContratoDto {
  @ApiProperty({
    example: 1,
    description: 'ID del contrato',
  })
  contrato_id: number;

  @ApiProperty({
    example: 5,
    description: 'Total de guardas activos simultáneos requeridos por el contrato (suma de todos los subpuestos)',
  })
  total_guardas_activos: number;

  @ApiProperty({
    example: 15,
    description: 'Total de guardas necesarios calculados según los ciclos de turnos (guardas_activos × estados_ciclo)',
  })
  total_guardas_necesarios: number;

  @ApiProperty({
    example: 12,
    description: 'Total de empleados actualmente asignados al contrato',
  })
  total_empleados_asignados?: number;

  @ApiProperty({
    example: 3,
    description: 'Cupos disponibles (guardas_necesarios - empleados_asignados)',
  })
  cupos_disponibles?: number;
}
