import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, IsOptional, ValidateNested, IsArray, IsEnum, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class FacturaItemDto {
  @ApiProperty({ description: 'Descripción del ítem', example: 'Servicio de vigilancia' })
  @IsString()
  @IsNotEmpty()
  descripcion: string;

  @ApiProperty({ description: 'Cantidad', example: 1 })
  @IsNumber()
  @IsNotEmpty()
  cantidad: number;

  @ApiProperty({ description: 'Precio unitario sin impuestos', example: 1500000 })
  @IsNumber()
  @IsNotEmpty()
  precio_unitario: number;

  @ApiProperty({ description: 'Porcentaje de impuesto (ej. 19 para IVA)', example: 19 })
  @IsNumber()
  @IsOptional()
  impuesto_tasa?: number;
}

export class CrearFacturaDto {
  @ApiProperty({ description: 'ID del cliente en Prolicontrol', example: 1 })
  @IsNumber()
  @IsNotEmpty()
  cliente_id: number;

  @ApiProperty({ description: 'Fecha de emisión de la factura', example: '2023-10-01' })
  @IsDateString()
  @IsOptional()
  fecha_emision?: string;

  @ApiProperty({ description: 'Fecha de vencimiento', example: '2023-10-31' })
  @IsDateString()
  @IsOptional()
  fecha_vencimiento?: string;

  @ApiProperty({ description: 'Observaciones para la factura', example: 'Pago a 30 días' })
  @IsString()
  @IsOptional()
  observaciones?: string;

  @ApiProperty({ type: [FacturaItemDto], description: 'Ítems de la factura' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FacturaItemDto)
  items: FacturaItemDto[];
}
