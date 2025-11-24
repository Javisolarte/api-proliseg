import { ApiProperty, PartialType } from "@nestjs/swagger";
import { IsInt, IsString, IsOptional, IsJSON } from "class-validator";
import { Transform } from "class-transformer";

export class CreateReporteDto {
    @ApiProperty({ example: "incidencias_mensual" })
    @IsString()
    tipo_reporte: string;

    @ApiProperty({ example: { mes: 10, anio: 2023 }, required: false })
    @IsOptional()
    @IsJSON()
    parametros?: any;

    @ApiProperty({ example: 1 })
    @IsInt()
    @Transform(({ value }) => parseInt(value))
    generado_por: number;

    @ApiProperty({ example: "https://example.com/reporte.pdf", required: false })
    @IsOptional()
    @IsString()
    url_archivo?: string;
}

export class UpdateReporteDto extends PartialType(CreateReporteDto) { }
