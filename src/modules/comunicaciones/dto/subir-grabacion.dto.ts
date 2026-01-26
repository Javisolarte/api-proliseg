import { IsNotEmpty, IsString, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export class SubirGrabacionDto {
    @ApiProperty({ description: 'ID de la sesión de comunicación' })
    @IsString()
    @IsNotEmpty()
    sesion_id: string;

    @ApiProperty({ description: 'ID del empleado' })
    @Type(() => Number)
    @IsNumber()
    @IsNotEmpty()
    empleado_id: number;

    @ApiPropertyOptional({ description: 'ID del puesto' })
    @Type(() => Number)
    @IsNumber()
    @IsOptional()
    puesto_id?: number;

    @ApiPropertyOptional({ description: 'ID del usuario del dashboard' })
    @Type(() => Number)
    @IsNumber()
    @IsOptional()
    usuario_dashboard_id?: number;

    @ApiProperty({ description: 'Tipo de comunicación (audio/video/emergencia)' })
    @IsString()
    @IsNotEmpty()
    tipo: string;

    @ApiProperty({ description: 'Latitud desde donde se grabó' })
    @Transform(({ value }) => parseFloat(value))
    @IsNumber()
    @IsNotEmpty()
    latitud: number;

    @ApiProperty({ description: 'Longitud desde donde se grabó' })
    @Transform(({ value }) => parseFloat(value))
    @IsNumber()
    @IsNotEmpty()
    longitud: number;

    @ApiProperty({ description: 'Duración en segundos' })
    @Type(() => Number)
    @IsNumber()
    @IsNotEmpty()
    duracion_segundos: number;

    @ApiProperty({ description: 'Fecha de inicio de la llamada' })
    @IsString()
    @IsNotEmpty()
    fecha_inicio: string;
}
