import { IsString, IsOptional, IsNumber, IsArray } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class IniciarVisitaDto {
    @ApiProperty({ description: "URL de la foto de llegada" })
    @IsString()
    foto_llegada_url: string;

    @ApiProperty({ description: "Observaciones opcionales al llegar", required: false })
    @IsOptional()
    @IsString()
    notas_llegada?: string;
}

export class ActualizarVisitaAppDto {
    @ApiProperty({ description: "Novedades encontradas", required: false })
    @IsOptional()
    @IsString()
    novedades?: string;

    @ApiProperty({ description: "Conclusión parcial", required: false })
    @IsOptional()
    @IsString()
    conclusion?: string;

    @ApiProperty({ description: "Costo estimado del arreglo", required: false })
    @IsOptional()
    @IsNumber()
    costo_arreglo?: number;

    @ApiProperty({ description: "URLs de fotos adicionales", required: false, type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    fotos_adicionales?: string[];
}

export class FinalizarVisitaAppDto {
    @ApiProperty({ description: "Conclusión final del técnico" })
    @IsString()
    conclusion: string;

    @ApiProperty({ description: "Registro de novedades final", required: false })
    @IsOptional()
    @IsString()
    novedades?: string;

    @ApiProperty({ description: "Costo total del arreglo", required: false })
    @IsOptional()
    @IsNumber()
    costo_arreglo?: number;

    @ApiProperty({ description: "Firma del técnico en base64 (obligatoria)" })
    @IsString()
    firma_tecnico_base64: string;

    @ApiProperty({ description: "Firma de quien recibe en base64 (opcional)", required: false })
    @IsOptional()
    @IsString()
    firma_recibe_base64?: string;

    @ApiProperty({ description: "Nombre de quien recibe la visita (opcional)", required: false })
    @IsOptional()
    @IsString()
    nombre_recibe?: string;
}
