import { IsNotEmpty, IsString, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubirGrabacionDto {
    @ApiProperty({ description: 'ID de la sesión de comunicación' })
    @IsString()
    @IsNotEmpty()
    sesion_id: string;

    @ApiProperty({ description: 'ID del empleado' })
    @IsNumber()
    @IsNotEmpty()
    empleado_id: number;

    @ApiPropertyOptional({ description: 'ID del puesto' })
    @IsNumber()
    @IsOptional()
    puesto_id?: number;

    @ApiPropertyOptional({ description: 'ID del usuario del dashboard' })
    @IsNumber()
    @IsOptional()
    usuario_dashboard_id?: number;

    @ApiProperty({ description: 'Tipo de comunicación (audio/video/emergencia)' })
    @IsString()
    @IsNotEmpty()
    tipo: string;

    @ApiProperty({ description: 'Latitud desde donde se grabó' })
    @IsNumber()
    @IsNotEmpty()
    latitud: number;

    @ApiProperty({ description: 'Longitud desde donde se grabó' })
    @IsNumber()
    @IsNotEmpty()
    longitud: number;

    @ApiProperty({ description: 'Duración en segundos' })
    @IsNumber()
    @IsNotEmpty()
    duracion_segundos: number;

    @ApiProperty({ description: 'Fecha de inicio de la llamada' })
    @IsString()
    @IsNotEmpty()
    fecha_inicio: string;
}
