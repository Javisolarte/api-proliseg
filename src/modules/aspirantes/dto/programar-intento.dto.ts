import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class ProgramarIntentoDto {
    @ApiProperty({ description: 'ID del aspirante', example: 50 })
    @IsInt()
    @IsNotEmpty()
    aspirante_id: number;

    @ApiProperty({ description: 'ID de la prueba a presentar', example: 12 })
    @IsInt()
    @IsNotEmpty()
    prueba_id: number;

    @ApiProperty({ description: 'Fecha programada para la prueba (YYYY-MM-DD)', example: '2024-02-20' })
    @IsDateString()
    @IsNotEmpty()
    fecha_programada: string;

    @ApiProperty({ description: 'Hora de inicio permitida (HH:MM)', example: '08:00' })
    @IsString()
    @IsNotEmpty()
    hora_inicio: string;

    @ApiProperty({ description: 'Hora límite para terminar (HH:MM)', example: '18:00' })
    @IsString()
    @IsNotEmpty()
    hora_fin: string;

    @ApiProperty({ description: 'Dirección física donde debe estar el aspirante', example: 'Calle 123 # 45-67, Bogotá' })
    @IsString()
    @IsNotEmpty()
    direccion: string;

    @ApiProperty({ description: 'Latitud de la ubicación permitida', example: 4.60971 })
    @IsNumber()
    @IsNotEmpty()
    latitud: number;

    @ApiProperty({ description: 'Longitud de la ubicación permitida', example: -74.08175 })
    @IsNumber()
    @IsNotEmpty()
    longitud: number;

    @ApiPropertyOptional({ description: 'Radio permitido en metros', default: 100, example: 50 })
    @IsNumber()
    @IsOptional()
    @Min(10)
    radio_metros?: number;
}

export class ReprogramarIntentoDto {
    @ApiProperty({ description: 'Nueva fecha programada (YYYY-MM-DD)', example: '2024-02-21' })
    @IsDateString()
    @IsNotEmpty()
    fecha_programada: string;

    @ApiProperty({ description: 'Nueva hora de inicio', example: '14:00' })
    @IsString()
    @IsNotEmpty()
    hora_inicio: string;

    @ApiProperty({ description: 'Nueva hora fin', example: '16:00' })
    @IsString()
    @IsNotEmpty()
    hora_fin: string;

    @ApiPropertyOptional({ description: 'Nueva dirección', example: 'Sede Norte' })
    @IsString()
    @IsOptional()
    direccion?: string;

    @ApiPropertyOptional({ description: 'Nueva latitud' })
    @IsNumber()
    @IsOptional()
    latitud?: number;

    @ApiPropertyOptional({ description: 'Nueva longitud' })
    @IsNumber()
    @IsOptional()
    longitud?: number;
}
