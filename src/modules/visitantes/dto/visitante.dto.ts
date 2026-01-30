import { IsString, IsNotEmpty, IsOptional } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateVisitanteDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    documento: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    nombre_completo: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    empresa_arl?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    foto_url?: string;
}

export class UpdateVisitanteDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    nombre_completo?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    empresa_arl?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    foto_url?: string;
}
