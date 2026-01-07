import { ApiProperty, PartialType } from "@nestjs/swagger";
import {
    IsInt,
    IsString,
    IsOptional,
    IsEnum,
    IsBoolean,
    IsArray,
    IsDateString,
    IsNotEmpty,
} from "class-validator";

export enum MemorandoTipo {
    INFORMATIVO = "informativo",
    PREVENTIVO = "preventivo",
    DISCIPLINARIO = "disciplinario",
    LLAMADO_ATENCION = "llamado_atencion",
}

export enum MemorandoGravedad {
    BAJO = "bajo",
    MEDIO = "medio",
    ALTO = "alto",
    CRITICO = "critico",
}

export enum MemorandoEstado {
    BORRADOR = "borrador",
    ENVIADO = "enviado",
    LEIDO = "leido",
    FIRMADO = "firmado",
    CERRADO = "cerrado",
    ANULADO = "anulado",
}

export class CreateMemorandoDto {
    @ApiProperty({
        example: "MEM-2024-001",
        description: "Código único el memorando",
        required: false,
    })
    @IsOptional()
    @IsString()
    codigo?: string;

    @ApiProperty({
        example: "Llamado de atención por tardanza",
        description: "Título del memorando",
    })
    @IsString()
    @IsNotEmpty()
    titulo: string;

    @ApiProperty({
        example: "llamado_atencion",
        enum: MemorandoTipo,
        description: "Tipo de memorando",
    })
    @IsEnum(MemorandoTipo)
    tipo: MemorandoTipo;

    @ApiProperty({
        example: "Se le informa que ha llegado tarde 3 veces esta semana...",
        description: "Descripción detallada del memorando",
    })
    @IsString()
    @IsNotEmpty()
    descripcion: string;

    @ApiProperty({
        example: "bajo",
        enum: MemorandoGravedad,
        description: "Nivel de gravedad",
        required: false,
    })
    @IsOptional()
    @IsEnum(MemorandoGravedad)
    nivel_gravedad?: MemorandoGravedad;

    @ApiProperty({
        example: true,
        description: "Indica si el memorando requiere firma del empleado",
        default: false,
    })
    @IsOptional()
    @IsBoolean()
    requiere_firma?: boolean;

    @ApiProperty({
        example: "2024-12-31T23:59:59Z",
        description: "Fecha límite para firmar el memorando",
        required: false,
    })
    @IsOptional()
    @IsDateString()
    fecha_limite_firma?: string;
}

export class UpdateMemorandoDto extends PartialType(CreateMemorandoDto) { }

export class AssignMemorandoDto {
    @ApiProperty({
        example: [1, 2, 3],
        description: "Lista de IDs de empleados a los que se asignará el memorando",
    })
    @IsArray()
    @IsInt({ each: true })
    empleados_ids: number[];
}

export class SignMemorandoDto {
    @ApiProperty({
        example: "digital",
        description: "Método de firma",
        default: "digital",
    })
    @IsOptional()
    @IsString()
    metodo_firma?: string;

    @ApiProperty({
        example: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgA...",
        description: "Firma en formato base64",
    })
    @IsString()
    @IsNotEmpty()
    firma_base64: string;

    @ApiProperty({
        example: "iPhone 13 - Safari",
        description: "Dispositivo desde el que se firma",
        required: false,
    })
    @IsOptional()
    @IsString()
    dispositivo?: string;

    @ApiProperty({
        example: "Mozilla/5.0...",
        description: "User Agent del navegador",
        required: false,
    })
    @IsOptional()
    @IsString()
    user_agent?: string;

    @ApiProperty({
        example: "He leído y acepto los términos.",
        description: "Observación opcional del empleado",
        required: false,
    })
    @IsOptional()
    @IsString()
    observacion_empleado?: string;
}

export class CreateAttachmentDto {
    @ApiProperty({
        example: "imagen",
        enum: ['imagen', 'pdf', 'audio', 'video', 'otro'],
        description: "Tipo de archivo adjunto",
    })
    @IsString()
    tipo: string;

    @ApiProperty({
        example: "https://supabase.url/storage/v1/object/public/...",
        description: "URL del archivo adjunto",
    })
    @IsString()
    url: string;

    @ApiProperty({
        example: "Evidencia de la tardanza",
        description: "Descripción del adjunto",
        required: false,
    })
    @IsOptional()
    @IsString()
    descripcion?: string;
}
