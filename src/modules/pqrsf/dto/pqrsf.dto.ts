import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsInt, IsUrl, IsBoolean } from 'class-validator';

export enum PqrsfTipo {
    PETICION = 'peticion',
    QUEJA = 'queja',
    RECLAMO = 'reclamo',
    SUGERENCIA = 'sugerencia',
    FELICITACION = 'felicitacion'
}

export enum PqrsfPrioridad {
    BAJA = 'baja',
    MEDIA = 'media',
    ALTA = 'alta',
    CRITICA = 'critica'
}

export enum PqrsfEstado {
    ABIERTO = 'abierto',
    EN_PROCESO = 'en_proceso',
    RESPONDIDO = 'respondido',
    CERRADO = 'cerrado'
}

export class CreatePqrsfDto {
    @ApiProperty({ example: 1, description: 'ID del cliente asociado' })
    @IsInt()
    @IsNotEmpty()
    cliente_id: number;

    @ApiProperty({ enum: PqrsfTipo, example: PqrsfTipo.PETICION })
    @IsEnum(PqrsfTipo)
    @IsNotEmpty()
    tipo: PqrsfTipo;

    @ApiProperty({ example: 'Solicitud de información', description: 'Asunto del PQRSF' })
    @IsString()
    @IsNotEmpty()
    asunto: string;

    @ApiProperty({ example: 'Quisiera solicitar más información sobre...', description: 'Descripción detallada' })
    @IsString()
    @IsNotEmpty()
    descripcion: string;

    @ApiProperty({ enum: PqrsfPrioridad, example: PqrsfPrioridad.MEDIA, required: false })
    @IsOptional()
    @IsEnum(PqrsfPrioridad)
    prioridad?: PqrsfPrioridad;

    @ApiProperty({ example: 10, description: 'ID del contrato relacionado (opcional)', required: false })
    @IsOptional()
    @IsInt()
    contrato_id?: number;

    @ApiProperty({ example: 5, description: 'ID del puesto relacionado (opcional)', required: false })
    @IsOptional()
    @IsInt()
    puesto_id?: number;
}

export class UpdatePqrsfDto extends PartialType(CreatePqrsfDto) {
    @ApiProperty({ enum: PqrsfEstado, example: PqrsfEstado.EN_PROCESO, required: false })
    @IsOptional()
    @IsEnum(PqrsfEstado)
    estado?: PqrsfEstado;
}

export class AddRespuestaDto {
    @ApiProperty({ example: 'Hemos recibido su solicitud y...', description: 'Contenido de la respuesta' })
    @IsString()
    @IsNotEmpty()
    mensaje: string;

    @ApiProperty({ example: true, description: 'Si es visible para el cliente', default: true })
    @IsOptional()
    @IsBoolean()
    visible_para_cliente?: boolean;
}

export class AddAdjuntoDto {
    @ApiProperty({ example: 'imagen', description: 'Tipo de archivo (imagen, pdf, etc)' })
    @IsString()
    @IsNotEmpty()
    tipo: string;

    @ApiProperty({ example: 'https://example.com/file.jpg', description: 'URL del archivo' })
    @IsUrl()
    @IsNotEmpty()
    url: string;
}
