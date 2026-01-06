import { ApiProperty, PartialType } from "@nestjs/swagger";
import {
    IsInt,
    IsString,
    IsOptional,
    IsDateString,
    IsEnum,
} from "class-validator";

export enum EstadoEstudio {
    VIGENTE = "vigente",
    VENCIDO = "vencido",
    ANULADO = "anulado",
}

export class CreateEstudioSeguridadDto {
    @ApiProperty({
        example: 1,
        description: "ID del puesto asociado",
    })
    @IsInt({ message: "El campo puesto_id debe ser un número entero" })
    puesto_id: number;

    @ApiProperty({
        example: "2024-01-01",
        description: "Fecha en la que se realizó el estudio",
    })
    @IsDateString({}, { message: "fecha_estudio debe ser una fecha válida" })
    fecha_estudio: string;

    @ApiProperty({
        example: "2025-01-01",
        description: "Fecha de vencimiento del estudio",
    })
    @IsDateString({}, { message: "fecha_vencimiento debe ser una fecha válida" })
    fecha_vencimiento: string;

    @ApiProperty({
        example: "Observaciones del estudio...",
        required: false,
        description: "Observaciones adicionales",
    })
    @IsOptional()
    @IsString()
    observaciones?: string;

    @ApiProperty({
        enum: EstadoEstudio,
        example: EstadoEstudio.VIGENTE,
        default: EstadoEstudio.VIGENTE,
        description: "Estado del estudio",
    })
    @IsOptional()
    @IsEnum(EstadoEstudio)
    estado?: EstadoEstudio;
}

export class UpdateEstudioSeguridadDto extends PartialType(CreateEstudioSeguridadDto) { }
