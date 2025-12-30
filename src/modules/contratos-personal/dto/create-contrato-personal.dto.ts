import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export enum TipoContrato {
    PRUEBA_3_MESES = 'prueba_3_meses',
    TERMINO_FIJO = 'termino_fijo',
    TERMINO_INDEFINIDO = 'termino_indefinido',
    OBRA_LABOR = 'obra_labor',
}

export enum ModalidadTrabajo {
    TIEMPO_COMPLETO = 'tiempo_completo',
    MEDIO_TIEMPO = 'medio_tiempo',
    VIRTUAL = 'virtual',
    POR_HORAS = 'por_horas',
    TURNOS = 'turnos',
    PRACTICAS = 'practicas',
    OTRO = 'otro',
}

export class CreateContratoPersonalDto {
    @ApiProperty({ description: 'ID del empleado', example: 1 })
    @IsInt()
    @Transform(({ value }) => parseInt(value))
    empleado_id: number;

    @ApiProperty({ enum: TipoContrato, description: 'Tipo de contrato' })
    @IsEnum(TipoContrato)
    tipo_contrato: TipoContrato;

    @ApiProperty({ description: 'Fecha de inicio (YYYY-MM-DD)', example: '2023-01-01' })
    @IsDateString()
    fecha_inicio: string;

    @ApiProperty({ description: 'Fecha de fin (YYYY-MM-DD)', required: false, example: '2023-12-31' })
    @IsOptional()
    @IsDateString()
    fecha_fin?: string;

    @ApiProperty({ description: 'Fecha fin de periodo de prueba (YYYY-MM-DD)', required: false })
    @IsOptional()
    @IsDateString()
    fecha_fin_prueba?: string;

    @ApiProperty({ description: 'ID del salario', example: 1 })
    @IsInt()
    @Transform(({ value }) => parseInt(value))
    salario_id: number;

    // Archivos
    @ApiProperty({ type: 'string', format: 'binary', required: false, description: 'PDF del contrato' })
    @IsOptional()
    contrato_pdf?: any;

    @ApiProperty({
        enum: ModalidadTrabajo,
        description: 'Modalidad de trabajo',
        example: ModalidadTrabajo.TIEMPO_COMPLETO,
        default: ModalidadTrabajo.TIEMPO_COMPLETO
    })
    @IsOptional()
    @IsEnum(ModalidadTrabajo)
    modalidad_trabajo?: ModalidadTrabajo;
}
