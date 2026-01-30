import { IsString, IsNotEmpty, IsNumber, IsOptional, IsBoolean } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateVerificacionDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    aspirante_id?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    empleado_id?: number;
}

export class CreateReferenciaDetalleDto {
    @ApiProperty()
    @IsNumber()
    verificacion_id: number;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    tipo_referencia: 'laboral' | 'personal' | 'academica';

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    nombre_contacto?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    empresa_institucion?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    telefono?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    resultado_verificacion?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    es_valida?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    observaciones?: string;
}

export class FinalizarVerificacionDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    conclusiones: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    documento_final_id?: number;
}
