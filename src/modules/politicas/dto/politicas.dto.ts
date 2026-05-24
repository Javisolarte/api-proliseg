import { IsArray, IsBoolean, IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class PaginaPoliticaDto {
    @IsNumber()
    @Min(1)
    numero_pagina: number;

    @IsString()
    titulo: string;

    @IsString()
    contenido: string;
}

export class CrearPoliticaDto {
    @IsString()
    codigo: string;

    @IsString()
    nombre: string;

    @IsString()
    version: string;

    @IsString()
    contenido: string;

    @IsOptional()
    @IsString()
    tipo_documento?: string;

    @IsOptional()
    @IsString()
    resumen?: string;

    @IsOptional()
    @IsBoolean()
    requiere_aceptacion?: boolean;

    @IsOptional()
    @IsBoolean()
    bloquea_si_no_acepta?: boolean;

    @IsOptional()
    @IsArray()
    paginas?: PaginaPoliticaDto[];

    @IsOptional()
    @IsObject()
    metadatos?: Record<string, unknown>;
}

export class RegistrarConsentimientoDto {
    @IsNumber()
    politica_id: number;

    @IsBoolean()
    aceptado: boolean;

    @IsOptional()
    @IsString()
    metodo_firma?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    tiempo_lectura_segundos?: number;

    @IsOptional()
    @IsString()
    pantalla_origen?: string;

    @IsOptional()
    @IsString()
    rechazo_motivo?: string;

    @IsOptional()
    @IsObject()
    metadatos?: Record<string, unknown>;
}

export class ConsultarEstadoLegalDto {
    usuario_id?: number;
    empleado_id?: number;
}
