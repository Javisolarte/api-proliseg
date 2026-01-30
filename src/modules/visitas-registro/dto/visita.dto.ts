import { IsString, IsNotEmpty, IsNumber, IsOptional } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateVisitaRegistroDto {
    @ApiProperty()
    @IsNumber()
    puesto_id: number;

    @ApiProperty()
    @IsNumber()
    visitante_id: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    residente_destino_id?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    vehiculo_placa?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    parqueadero_asignado?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    autorizado_por?: string;

    @ApiProperty()
    @IsString()
    tipo_ingreso: 'visitante' | 'domiciliario' | 'contratista' | 'prestador_servicio';

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    observaciones?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    evidencia_entrada_url?: string;
}

export class RegistrarSalidaDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    observaciones?: string;
}
