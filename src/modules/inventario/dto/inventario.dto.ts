import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// --- DOCUMENTOS ---

export enum TipoDocumento {
    FACTURA = 'factura',
    PEDIDO = 'pedido',
    REMISION = 'remision',
}

export class CreateInventarioDocumentoDto {
    @ApiProperty({ description: 'ID del proveedor', example: 1 })
    @IsInt()
    @IsNotEmpty()
    proveedor_id: number;

    @ApiProperty({ description: 'Tipo de documento', enum: TipoDocumento, example: 'factura' })
    @IsEnum(TipoDocumento)
    @IsNotEmpty()
    tipo: string;

    @ApiProperty({ description: 'Número de documento', example: 'F-1001' })
    @IsString()
    @IsNotEmpty()
    numero_documento: string;

    @ApiProperty({ description: 'Fecha del documento', example: '2023-10-27' })
    @IsDateString()
    @IsNotEmpty()
    fecha: string;

    @ApiProperty({ description: 'URL del PDF', required: false })
    @IsString()
    @IsOptional()
    url_pdf?: string;

    @ApiProperty({ description: 'Creado por (ID Usuario)' })
    @IsInt()
    @IsOptional()
    creado_por?: number;
}

// --- MOVIMIENTOS ---

export enum TipoMovimiento {
    ENTRADA = 'entrada',
    SALIDA = 'salida',
    AJUSTE = 'ajuste',
}

export class CreateInventarioMovimientoDto {
    @ApiProperty({ description: 'ID de la variante del artículo', example: 1 })
    @IsInt()
    @IsNotEmpty()
    variante_id: number;

    @ApiProperty({ description: 'Tipo de movimiento', enum: TipoMovimiento, example: 'entrada' })
    @IsEnum(TipoMovimiento)
    @IsNotEmpty()
    tipo_movimiento: string;

    @ApiProperty({ description: 'Cantidad', example: 10 })
    @IsInt()
    @Min(1)
    @IsNotEmpty()
    cantidad: number;

    @ApiProperty({ description: 'Motivo del movimiento', example: 'Compra de inventario inicial' })
    @IsString()
    @IsOptional() // Optional but recommended
    motivo?: string;

    @ApiProperty({ description: 'ID del documento asociado (opcional)', required: false })
    @IsInt()
    @IsOptional()
    documento_id?: number;

    @ApiProperty({ description: 'ID del empleado asociado (opcional, para salidas)', required: false })
    @IsInt()
    @IsOptional()
    empleado_id?: number;

    @ApiProperty({ description: 'Realizado por (ID Usuario)' })
    @IsInt()
    @IsOptional()
    realizado_por?: number;
}
