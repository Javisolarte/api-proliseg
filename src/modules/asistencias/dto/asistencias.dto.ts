import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, IsOptional, IsISO8601 } from 'class-validator';
import { RegistrarEntradaDto } from './registrar_entrada.dto';

export class UpdateAsistenciaDto extends PartialType(RegistrarEntradaDto) {
    @ApiProperty({ example: '2025-01-15T08:00:00Z', required: false })
    @IsOptional()
    @IsISO8601()
    hora_entrada?: string;

    @ApiProperty({ example: '2025-01-15T16:00:00Z', required: false })
    @IsOptional()
    @IsISO8601()
    hora_salida?: string;

    @ApiProperty({ example: 'cumplido', required: false })
    @IsOptional()
    @IsString()
    estado_asistencia?: string;
}

export class CerrarTurnoManualDto {
    @ApiProperty({ example: 10, description: 'ID del turno' })
    @IsNotEmpty()
    @IsNumber()
    turno_id: number;

    @ApiProperty({ example: 1, description: 'ID del empleado' })
    @IsNotEmpty()
    @IsNumber()
    empleado_id: number;

    @ApiProperty({ example: 'Cerrado manualmente por supervisor', required: false })
    @IsOptional()
    @IsString()
    observaciones?: string;

    @ApiProperty({ example: '2025-01-15T17:00:00Z', description: 'Hora de salida manual', required: false })
    @IsOptional()
    @IsISO8601()
    hora_salida?: string;
}

export class RegistrarEntradaManualDto {
    @ApiProperty({ example: 1, description: 'ID del empleado' })
    @IsNotEmpty()
    @IsNumber()
    empleado_id: number;

    @ApiProperty({ example: 10, description: 'ID del turno' })
    @IsNotEmpty()
    @IsNumber()
    turno_id: number;

    @ApiProperty({ example: 'Registro manual por contingencia', required: false })
    @IsOptional()
    @IsString()
    observaciones?: string;
}

export class RegistrarSalidaManualDto {
    @ApiProperty({ example: 1, description: 'ID del empleado' })
    @IsNotEmpty()
    @IsNumber()
    empleado_id: number;

    @ApiProperty({ example: 10, description: 'ID del turno' })
    @IsNotEmpty()
    @IsNumber()
    turno_id: number;

    @ApiProperty({ example: 'Salida manual autorizada', required: false })
    @IsOptional()
    @IsString()
    observaciones?: string;
}
