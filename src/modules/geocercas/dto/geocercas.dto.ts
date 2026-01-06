import { ApiProperty, PartialType } from "@nestjs/swagger";
import {
    IsInt,
    IsString,
    IsOptional,
    IsNumber,
    IsBoolean,
    Min,
    Max,
    IsEnum,
} from "class-validator";

export enum TipoGeocerca {
    PUESTO = "puesto",
    RUTA_PUNTO = "ruta_punto",
    CUSTOM = "custom",
}

export class CreateGeocercaDto {
    @ApiProperty({
        example: "Geocerca Puesto Central",
        description: "Nombre de la geocerca",
    })
    @IsString({ message: "El campo nombre debe ser texto" })
    nombre: string;

    @ApiProperty({
        enum: TipoGeocerca,
        example: TipoGeocerca.PUESTO,
        description: "Tipo de geocerca",
    })
    @IsEnum(TipoGeocerca)
    tipo: TipoGeocerca;

    @ApiProperty({
        example: 4.711,
        required: false,
        description: "Latitud del centro de la geocerca (para circulares)",
    })
    @IsOptional()
    @IsNumber()
    @Min(-90)
    @Max(90)
    latitud?: number;

    @ApiProperty({
        example: -74.0722,
        required: false,
        description: "Longitud del centro de la geocerca (para circulares)",
    })
    @IsOptional()
    @IsNumber()
    @Min(-180)
    @Max(180)
    longitud?: number;

    @ApiProperty({
        example: 100,
        required: false,
        description: "Radio de la geocerca en metros (para circulares)",
    })
    @IsOptional()
    @IsNumber()
    @Min(1)
    radio_metros?: number;

    @ApiProperty({
        example: true,
        required: false,
        description: "Estado activo de la geocerca",
    })
    @IsOptional()
    @IsBoolean()
    activo?: boolean;
}

export class UpdateGeocercaDto extends PartialType(CreateGeocercaDto) { }

export class CreateGeocercaVertexDto {
    @ApiProperty({ example: 4.71, description: "Latitud del vértice" })
    @IsNumber()
    @Min(-90)
    @Max(90)
    latitud: number;

    @ApiProperty({ example: -74.07, description: "Longitud del vértice" })
    @IsNumber()
    @Min(-180)
    @Max(180)
    longitud: number;

    @ApiProperty({ example: 1, description: "Orden del vértice en el polígono" })
    @IsInt()
    @Min(1)
    orden: number;
}

export class CreateGeocercaVerticesDto {
    @ApiProperty({
        type: [CreateGeocercaVertexDto],
        description: "Lista de vértices que componen el polígono",
    })
    vertices: CreateGeocercaVertexDto[];
}

export class UpdateGeocercaVerticesDto extends PartialType(CreateGeocercaVerticesDto) { }

export class EvaluarGPSDto {
    @ApiProperty({ example: 12, description: "ID del empleado" })
    @IsInt()
    empleado_id: number;

    @ApiProperty({ example: 4.710989, description: "Latitud actual" })
    @IsNumber()
    latitud: number;

    @ApiProperty({ example: -74.072092, description: "Longitud actual" })
    @IsNumber()
    longitud: number;

    @ApiProperty({ example: 8, required: false, description: "Precisión del GPS" })
    @IsOptional()
    @IsNumber()
    precision?: number;
}
