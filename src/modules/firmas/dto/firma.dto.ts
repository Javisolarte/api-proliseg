import { IsString, IsNotEmpty, IsNumber, IsOptional, IsBoolean } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateFirmaDto {
    @ApiProperty()
    @IsNumber()
    documento_id: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    usuario_id?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    empleado_id?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    nombre_firmante?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    documento_identidad_firmante?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    cargo_firmante?: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    tipo_firma: 'digital' | 'manuscrita_capturada' | 'biometrica';

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    firma_base64: string;

    @ApiProperty({ required: false, description: "Huella digital en base64" })
    @IsOptional()
    @IsString()
    huella_base64?: string;

    @ApiProperty({ required: false, default: 1 })
    @IsOptional()
    @IsNumber()
    orden?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    es_ultima_firma?: boolean; // Flag to trigger auto-close
}
