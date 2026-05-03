import { IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// --- ARTICULOS ---

export class CreateArticuloDotacionDto {
    @ApiProperty({ description: 'Código único del artículo', example: 'CAM-001', required: false })
    @IsString()
    @IsOptional()
    codigo?: string;

    @ApiProperty({ description: 'Nombre del artículo', example: 'Camisa Operativa' })
    @IsString()
    @IsNotEmpty()
    nombre: string;

    @ApiProperty({ description: 'ID de la categoría del artículo', example: 1 })
    @IsInt()
    @IsNotEmpty()
    categoria_id: number;

    @ApiProperty({ description: 'Descripción del artículo', example: 'Camisa manga larga con logos', required: false })
    @IsString()
    @IsOptional()
    descripcion?: string;

    @ApiProperty({ description: 'ID del usuario que crea el artículo' })
    @IsInt()
    @IsOptional()
    creado_por?: number;

    @ApiProperty({ description: 'Metadatos dinámicos por categoría', required: false })
    @IsOptional()
    metadata?: any;
}

export class UpdateArticuloDotacionDto {
    @ApiProperty({ description: 'Código único del artículo', required: false })
    @IsString()
    @IsOptional()
    codigo?: string;

    @ApiProperty({ description: 'Nombre del artículo', required: false })
    @IsString()
    @IsOptional()
    nombre?: string;

    @ApiProperty({ description: 'ID de la categoría', required: false })
    @IsInt()
    @IsOptional()
    categoria_id?: number;

    @ApiProperty({ description: 'Descripción', required: false })
    @IsString()
    @IsOptional()
    descripcion?: string;

    @ApiProperty({ description: 'Estado activo/inactivo', required: false })
    @IsBoolean()
    @IsOptional()
    activo?: boolean;

    @ApiProperty({ description: 'ID del usuario que actualiza' })
    @IsInt()
    @IsOptional()
    actualizado_por?: number;

    @ApiProperty({ description: 'Metadatos dinámicos por categoría', required: false })
    @IsOptional()
    metadata?: any;
}

// --- VARIANTES ---

export class CreateVarianteArticuloDto {
    @ApiProperty({ description: 'ID del artículo padre', example: 1 })
    @IsInt()
    @IsNotEmpty()
    articulo_id: number;

    @ApiProperty({ description: 'Talla de la variante', example: 'L' })
    @IsString()
    @IsNotEmpty()
    talla: string;

    @ApiProperty({ description: 'Stock mínimo para alertas', example: 5, default: 5 })
    @IsInt()
    @Min(0)
    @IsOptional()
    stock_minimo?: number;

    @ApiProperty({ description: 'Stock actual inicial (Total)', example: 10, default: 0 })
    @IsInt()
    @Min(0)
    @IsOptional()
    stock_actual?: number;

    @ApiProperty({ description: 'Stock nuevo inicial', example: 10, default: 0 })
    @IsInt()
    @Min(0)
    @IsOptional()
    stock_nuevo?: number;

    @ApiProperty({ description: 'Stock de segunda inicial', example: 0, default: 0 })
    @IsInt()
    @Min(0)
    @IsOptional()
    stock_segunda?: number;
}

export class UpdateVarianteArticuloDto {
    @ApiProperty({ description: 'Talla', required: false })
    @IsString()
    @IsOptional()
    talla?: string;

    @ApiProperty({ description: 'Stock mínimo', required: false })
    @IsInt()
    @Min(0)
    @IsOptional()
    stock_minimo?: number;

    @ApiProperty({ description: 'Notificar bajo stock', required: false })
    @IsBoolean()
    @IsOptional()
    notificar?: boolean;

    @ApiProperty({ description: 'Stock actual', required: false })
    @IsInt()
    @Min(0)
    @IsOptional()
    stock_actual?: number;

    @ApiProperty({ description: 'Stock nuevo', required: false })
    @IsInt()
    @Min(0)
    @IsOptional()
    stock_nuevo?: number;

    @ApiProperty({ description: 'Stock de segunda', required: false })
    @IsInt()
    @Min(0)
    @IsOptional()
    stock_segunda?: number;
}
