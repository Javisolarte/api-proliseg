import { IsString, IsNotEmpty, IsNumber, IsOptional } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateInventarioDto {
    @ApiProperty()
    @IsNumber()
    puesto_id: number;

    @ApiProperty()
    @IsNumber()
    variante_articulo_id: number;

    @ApiProperty()
    @IsNumber()
    cantidad_actual: number;

    @ApiProperty({ required: false, default: 1 })
    @IsOptional()
    @IsNumber()
    cantidad_minima?: number;

    @ApiProperty({ required: false, default: 'bueno' })
    @IsOptional()
    @IsString()
    condicion?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    ubicacion_detalle?: string;
}

export class CreateMovimientoDto {
    @ApiProperty()
    @IsNumber()
    puesto_id: number;

    @ApiProperty()
    @IsNumber()
    variante_articulo_id: number;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    tipo_movimiento: 'entrega_a_puesto' | 'retiro_de_puesto' | 'consumo' | 'baja' | 'traslado';

    @ApiProperty()
    @IsNumber()
    cantidad: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    condicion?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    observacion?: string;
}

export class UpdateInventarioDto {
    // Can be used for partial updates if needed
}
