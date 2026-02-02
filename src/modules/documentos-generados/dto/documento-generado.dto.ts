import { ApiProperty, PartialType } from "@nestjs/swagger";
import {
    IsString,
    IsOptional,
    IsInt,
    IsEnum,
    IsNotEmpty,
    IsObject,
} from "class-validator";
import { Transform } from "class-transformer";

export enum EstadoDocumento {
    BORRADOR = 'borrador',
    PENDIENTE_FIRMAS = 'pendiente_firmas',
    FIRMADO = 'firmado',
    ANULADO = 'anulado'
}

export enum EntidadTipo {
    EMPLEADO = 'empleado',
    CLIENTE = 'cliente',
    PROVEEDOR = 'proveedor',
    RESIDENTE = 'residente',
    CONTRATO_PERSONAL = 'contrato_personal'
}

export class CreateDocumentoDto {
    @ApiProperty({ example: 1 })
    @IsInt()
    @Transform(({ value }) => parseInt(value))
    plantilla_id: number;

    @ApiProperty({ example: EntidadTipo.EMPLEADO, enum: EntidadTipo })
    @IsEnum(EntidadTipo)
    entidad_tipo: EntidadTipo;

    @ApiProperty({ example: 1 })
    @IsInt()
    @Transform(({ value }) => parseInt(value))
    entidad_id: number;

    @ApiProperty({
        example: { nombre: "Juan Pérez", cedula: "123456", cargo: "Vigilante" },
        description: "Objeto JSON con los datos para rellenar la plantilla"
    })
    @IsObject()
    @IsNotEmpty()
    datos_json: Record<string, any>;

    @ApiProperty({ required: false, example: "https://storage.supabase.co/..." })
    @IsOptional()
    @IsString()
    url_pdf?: string;
}

export class UpdateDocumentoGeneradoDto extends PartialType(CreateDocumentoDto) {
    @ApiProperty({ required: false, enum: EstadoDocumento })
    @IsOptional()
    @IsEnum(EstadoDocumento)
    estado?: EstadoDocumento;
}
