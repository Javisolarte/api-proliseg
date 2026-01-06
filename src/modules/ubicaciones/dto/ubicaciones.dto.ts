import { IsNumber, IsOptional, IsString, IsNotEmpty, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegistrarUbicacionDto {
    @ApiProperty({ example: 12 })
    @IsNumber()
    @IsNotEmpty()
    empleado_id: number;

    @ApiProperty({ example: 45 })
    @IsNumber()
    @IsNotEmpty()
    usuario_id: number;

    @ApiProperty({ example: 88, required: false })
    @IsOptional()
    @IsNumber()
    sesion_id?: number;

    @ApiProperty({ example: 4.7109123 })
    @IsNumber()
    latitud: number;

    @ApiProperty({ example: -74.0721123 })
    @IsNumber()
    longitud: number;

    @ApiProperty({ example: 8, required: false })
    @IsOptional()
    @IsNumber()
    precision_metros?: number;

    @ApiProperty({ example: 1.2, required: false })
    @IsOptional()
    @IsNumber()
    velocidad?: number;

    @ApiProperty({ example: 78, required: false })
    @IsOptional()
    @IsNumber()
    bateria?: number;

    @ApiProperty({ example: 'tracking', description: 'tracking, entrada_turno, salida_turno, boton_panico' })
    @IsString()
    @IsNotEmpty()
    evento: string;
}

export class FilterUbicacionDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    desde?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    hasta?: string;
}

export class MapaUbicacionDto {
    @ApiProperty({ example: 4.7110 })
    @IsNumber()
    lat: number;

    @ApiProperty({ example: -74.0721 })
    @IsNumber()
    lng: number;

    @ApiProperty({ example: 500 })
    @IsNumber()
    radio: number;
}
