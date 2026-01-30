import { IsString, IsNotEmpty, IsNumber, IsOptional, IsBoolean } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateConsentimientoDto {
    @ApiProperty()
    @IsNumber()
    empleado_id: number;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    tipo_consentimiento: string;

    @ApiProperty({ required: false, default: true })
    @IsOptional()
    @IsBoolean()
    acepta?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    firma_base64?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    documento_pdf_url?: string;
}
