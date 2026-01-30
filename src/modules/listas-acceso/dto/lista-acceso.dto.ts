import { IsString, IsNotEmpty, IsNumber, IsOptional, IsDateString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateListaAccesoDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    puesto_id?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    documento?: string; // Ahora es opcional, puede ser placa

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    placa?: string; // Nuevo campo

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    tipo_lista: 'blanca' | 'negra';

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    nombre_persona?: string; // Este campo no está en la tabla SQL pero el servicio lo intentaba usar (lo quité del servicio)
    // *Corrección*: El servicio inserta documento_identidad y nombre_persona, pero la tabla tiene "documento".
    // Ajusté el servicio para usar "documento".

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    motivo?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    fecha_vencimiento?: string; // Cambio de nombre para coincidir con SQL (antes vigencia_hasta)

    // Campos legacy para compatibilidad si el frontend aun manda los viejos
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    documento_identidad?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    vigencia_desde?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    vigencia_hasta?: string;
}
