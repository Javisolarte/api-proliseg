import { IsNumber, IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ActivarMiPanicoDto {
    @ApiProperty({ example: 4.7110, description: 'Latitud actual del dispositivo' })
    @IsNumber()
    @IsNotEmpty()
    latitud: number;

    @ApiProperty({ example: -74.0721, description: 'Longitud actual del dispositivo' })
    @IsNumber()
    @IsNotEmpty()
    longitud: number;

    @ApiProperty({ example: 3, description: 'ID del puesto donde se encuentra (opcional)', required: false })
    @IsOptional()
    @IsNumber()
    puesto_id?: number;

    @ApiProperty({ example: 8, description: 'ID del turno activo (opcional)', required: false })
    @IsOptional()
    @IsNumber()
    turno_id?: number;

    @ApiProperty({ example: 10, description: 'Precisión del GPS en metros (opcional)', required: false })
    @IsOptional()
    @IsNumber()
    precision_metros?: number;

    @ApiProperty({ example: 'android', description: 'Sistema operativo del dispositivo', required: false })
    @IsOptional()
    @IsString()
    dispositivo?: string;

    @ApiProperty({ example: '1.3.0', description: 'Versión de la aplicación móvil', required: false })
    @IsOptional()
    @IsString()
    version_app?: string;
}

export class RegistrarMiUbicacionDto {
    @ApiProperty({ example: 4.7109123, description: 'Latitud actual' })
    @IsNumber()
    @IsNotEmpty()
    latitud: number;

    @ApiProperty({ example: -74.0721123, description: 'Longitud actual' })
    @IsNumber()
    @IsNotEmpty()
    longitud: number;

    @ApiProperty({ example: 85, description: 'Nivel de batería del dispositivo (0-100)', required: false })
    @IsOptional()
    @IsNumber()
    bateria?: number;

    @ApiProperty({ example: 1.2, description: 'Velocidad de desplazamiento en m/s', required: false })
    @IsOptional()
    @IsNumber()
    velocidad?: number;

    @ApiProperty({ example: 10, description: 'Precisión del GPS en metros', required: false })
    @IsOptional()
    @IsNumber()
    precision_metros?: number;
}
