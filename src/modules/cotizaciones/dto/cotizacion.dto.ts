import { ApiProperty, PartialType } from "@nestjs/swagger";
import {
    IsString,
    IsOptional,
    IsInt,
    IsNumber,
    IsEnum,
    IsDateString,
    IsObject,
} from "class-validator";
import { Transform } from "class-transformer";

export enum EstadoCotizacion {
    BORRADOR = 'borrador',
    EN_PROCESO = 'en_proceso',
    APROBADA = 'aprobada',
    RECHAZADA = 'rechazada',
    VENCIDA = 'vencida'
}

export class CreateCotizacionDto {
    @ApiProperty({ example: 1, required: false, description: "ID del cliente. Null si es prospecto" })
    @IsOptional()
    @IsInt()
    @Transform(({ value }) => parseInt(value))
    cliente_id?: number;

    @ApiProperty({
        example: { empresa: "ABC Corp", nit: "900123456", contacto: "Juan Pérez" },
        required: false,
        description: "Datos del prospecto si no es cliente existente"
    })
    @IsOptional()
    @IsObject()
    prospecto_datos?: Record<string, any>;

    @ApiProperty({ example: "2024-02-01", required: false })
    @IsOptional()
    @IsDateString()
    fecha_emision?: string;

    @ApiProperty({ example: "2024-02-15" })
    @IsDateString()
    fecha_vencimiento: string;

    @ApiProperty({ example: 1000000 })
    @IsNumber()
    @Transform(({ value }) => parseFloat(value))
    subtotal: number;

    @ApiProperty({ example: 190000 })
    @IsNumber()
    @Transform(({ value }) => parseFloat(value))
    impuestos: number;

    @ApiProperty({ example: 1190000 })
    @IsNumber()
    @Transform(({ value }) => parseFloat(value))
    total: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    observaciones?: string;

    @ApiProperty({ description: 'ID de la plantilla de documento (opcional)', required: false })
    @IsOptional()
    @IsInt()
    @Transform(({ value }) => value ? parseInt(value) : undefined)
    plantilla_id?: number;
}

export class UpdateCotizacionDto extends PartialType(CreateCotizacionDto) {
    @ApiProperty({ required: false, enum: EstadoCotizacion })
    @IsOptional()
    @IsEnum(EstadoCotizacion)
    estado?: EstadoCotizacion;
}

export class CreateCotizacionItemDto {
    @ApiProperty({ example: 1 })
    @IsInt()
    @Transform(({ value }) => parseInt(value))
    cotizacion_id: number;

    @ApiProperty({ example: 1, required: false })
    @IsOptional()
    @IsInt()
    @Transform(({ value }) => parseInt(value))
    tipo_servicio_id?: number;

    @ApiProperty({ example: "Servicio de vigilancia diurna" })
    @IsString()
    descripcion: string;

    @ApiProperty({ example: 30 })
    @IsNumber()
    @Transform(({ value }) => parseFloat(value))
    cantidad: number;

    @ApiProperty({ example: 50000 })
    @IsNumber()
    @Transform(({ value }) => parseFloat(value))
    valor_unitario: number;

    @ApiProperty({ example: 1500000 })
    @IsNumber()
    @Transform(({ value }) => parseFloat(value))
    total_linea: number;
}
