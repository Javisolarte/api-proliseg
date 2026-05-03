import { IsNotEmpty, IsOptional, IsString, IsNumber, IsIn, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class EntregaDetalleDto {
    @ApiProperty({ description: 'ID de la variante del artículo' })
    @IsNumber()
    @IsNotEmpty()
    variante_id: number;

    @ApiProperty({ description: 'Cantidad a entregar' })
    @IsNumber()
    @IsNotEmpty()
    cantidad: number;

    @ApiProperty({ description: 'Condición del artículo', enum: ['nuevo', 'segunda'] })
    @IsString()
    @IsIn(['nuevo', 'segunda'])
    condicion: string;

    @ApiProperty({ description: 'Snapshot del ID de la categoría', required: false })
    @IsNumber()
    @IsOptional()
    categoria_snapshot_id?: number;
}

export class CreateEntregaInventarioDto {
    @ApiProperty({ description: 'Tipo de destinatario', enum: ['empleado', 'puesto', 'cliente'] })
    @IsString()
    @IsIn(['empleado', 'puesto', 'cliente'])
    tipo_destinatario: string;

    @ApiProperty({ description: 'ID del empleado, si aplica', required: false })
    @IsNumber()
    @IsOptional()
    empleado_id?: number;

    @ApiProperty({ description: 'ID del puesto, si aplica', required: false })
    @IsNumber()
    @IsOptional()
    puesto_id?: number;

    @ApiProperty({ description: 'ID del cliente, si aplica', required: false })
    @IsNumber()
    @IsOptional()
    cliente_id?: number;

    @ApiProperty({ description: 'Modalidad si es a cliente', enum: ['comodato', 'valor_agregado'], required: false })
    @IsString()
    @IsOptional()
    @IsIn(['comodato', 'valor_agregado'])
    modalidad_cliente?: string;

    @ApiProperty({ description: 'Observaciones generales', required: false })
    @IsString()
    @IsOptional()
    observaciones?: string;

    @ApiProperty({ description: 'Detalle de los artículos a entregar', type: [EntregaDetalleDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => EntregaDetalleDto)
    detalles: EntregaDetalleDto[];

    @ApiProperty({ description: 'Firma de quien recibe (cliente/empleado) en Base64', required: false })
    @IsString()
    @IsOptional()
    firma_cliente_base64?: string;

    @ApiProperty({ description: 'Nombre de quien recibe (cliente/empleado)', required: false })
    @IsString()
    @IsOptional()
    nombre_cliente?: string;

    @ApiProperty({ description: 'Cargo de quien recibe (cliente/empleado)', required: false })
    @IsString()
    @IsOptional()
    cargo_cliente?: string;

    @ApiProperty({ description: 'Cédula de quien recibe', required: false })
    @IsString()
    @IsOptional()
    cedula_recibe?: string;

    @ApiProperty({ description: 'URLs o base64 de fotos de evidencia', required: false })
    @IsArray()
    @IsOptional()
    fotos_evidencia?: string[];
}

export class DevolucionInventarioDto {
    @ApiProperty({ description: 'ID de la entrega original (o nulo si se devuelve por lote general)', required: false })
    @IsNumber()
    @IsOptional()
    entrega_origen_id?: number;

    @ApiProperty({ description: 'Tipo de origen de devolución', enum: ['empleado', 'puesto', 'cliente'] })
    @IsString()
    @IsIn(['empleado', 'puesto', 'cliente'])
    tipo_origen: string;

    @ApiProperty({ description: 'ID del empleado, puesto o cliente que devuelve', required: false })
    @IsNumber()
    @IsOptional()
    origen_id?: number;

    @ApiProperty({ description: 'Detalle de artículos devueltos', type: [EntregaDetalleDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => EntregaDetalleDto)
    detalles: EntregaDetalleDto[];

    @ApiProperty({ description: 'Observaciones', required: false })
    @IsString()
    @IsOptional()
    observaciones?: string;

    @ApiProperty({ description: 'Firma de quien entrega (cliente/empleado) en Base64', required: false })
    @IsString()
    @IsOptional()
    firma_cliente_base64?: string;

    @ApiProperty({ description: 'Nombre de quien entrega (cliente/empleado)', required: false })
    @IsString()
    @IsOptional()
    nombre_cliente?: string;

    @ApiProperty({ description: 'Cargo de quien entrega (cliente/empleado)', required: false })
    @IsString()
    @IsOptional()
    cargo_cliente?: string;
}

export class DestruccionInventarioDto {
    @ApiProperty({ description: 'ID de la variante a dar de baja' })
    @IsNumber()
    @IsNotEmpty()
    variante_id: number;

    @ApiProperty({ description: 'Cantidad a destruir' })
    @IsNumber()
    @IsNotEmpty()
    cantidad: number;

    @ApiProperty({ description: 'Condición del artículo a destruir (nuevo o segunda)', enum: ['nuevo', 'segunda'] })
    @IsString()
    @IsIn(['nuevo', 'segunda'])
    condicion: string;

    @ApiProperty({ description: 'Motivo de la destrucción' })
    @IsString()
    @IsNotEmpty()
    motivo: string;
}
