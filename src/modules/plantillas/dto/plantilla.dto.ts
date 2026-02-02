import { ApiProperty, PartialType } from "@nestjs/swagger";
import {
    IsString,
    IsOptional,
    IsInt,
    IsBoolean,
    IsArray,
    IsEnum,
    IsNotEmpty,
} from "class-validator";
import { Transform } from "class-transformer";

export enum TipoPlantilla {
    CONTRATO_CLIENTE = 'contrato_cliente',
    CONTRATO_EMPLEADO = 'contrato_empleado',
    CONSENTIMIENTO = 'consentimiento',
    AUTORIZACION_BUSQUEDA = 'autorizacion_busqueda',
    AUTORIZACION_DATOS = 'autorizacion_datos',
    CERTIFICADO = 'certificado',
    REFERENCIA = 'referencia',
    COTIZACION = 'cotizacion',
    OTRO = 'otro'
}

export class CreatePlantillaDto {
    @ApiProperty({ example: "Contrato de Servicios de Vigilancia" })
    @IsString()
    @IsNotEmpty()
    nombre: string;

    @ApiProperty({ example: TipoPlantilla.CONTRATO_CLIENTE, enum: TipoPlantilla })
    @IsEnum(TipoPlantilla)
    tipo: TipoPlantilla;

    @ApiProperty({
        example: "<h1>Contrato</h1><p>Entre {{nombre_cliente}} y {{nombre_empresa}}</p>",
        description: "HTML con variables usando {{variable}}"
    })
    @IsString()
    @IsNotEmpty()
    contenido_html: string;

    @ApiProperty({
        example: ["nombre_cliente", "nit", "fecha_inicio"],
        description: "Array de nombres de variables requeridas",
        required: false
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    variables_requeridas?: string[];

    @ApiProperty({ example: 1, required: false })
    @IsOptional()
    @IsInt()
    @Transform(({ value }) => parseInt(value))
    version?: number;

    @ApiProperty({ example: true, required: false })
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === 'true' || value === true)
    activa?: boolean;
}

export class UpdatePlantillaDto extends PartialType(CreatePlantillaDto) { }
