import { IsString, IsNumber, IsOptional, IsIn, IsNotEmpty, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ActivarPanicoDto {
    @ApiProperty({ example: 'empleado', enum: ['empleado', 'cliente'] })
    @IsString()
    @IsNotEmpty()
    @IsIn(['empleado', 'cliente'])
    origen: 'empleado' | 'cliente';

    @ApiProperty({ example: 12, required: false })
    @IsOptional()
    @IsNumber()
    empleado_id?: number;

    @ApiProperty({ example: 7, required: false })
    @IsOptional()
    @IsNumber()
    cliente_id?: number;

    @ApiProperty({ example: 45 })
    @IsNumber()
    usuario_id: number;

    @ApiProperty({ example: 3, required: false })
    @IsOptional()
    @IsNumber()
    puesto_id?: number;

    @ApiProperty({ example: 8, required: false })
    @IsOptional()
    @IsNumber()
    turno_id?: number;

    @ApiProperty({ example: 4.7110 })
    @IsNumber()
    latitud: number;

    @ApiProperty({ example: -74.0721 })
    @IsNumber()
    longitud: number;

    @ApiProperty({ example: 10, required: false })
    @IsOptional()
    @IsNumber()
    precision_metros?: number;

    @ApiProperty({ example: 'android', required: false })
    @IsOptional()
    @IsString()
    dispositivo?: string;

    @ApiProperty({ example: '1.3.0', required: false })
    @IsOptional()
    @IsString()
    version_app?: string;
}

export class AtenderPanicoDto {
    @ApiProperty({ example: 21 })
    @IsNumber()
    @IsNotEmpty()
    atendido_por: number;
}

export class FilterPanicoDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    puesto_id?: number;

    @ApiProperty({ required: false, enum: ['empleado', 'cliente'] })
    @IsOptional()
    @IsString()
    @IsIn(['empleado', 'cliente'])
    origen?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    desde?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    hasta?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    empleado_id?: number;
}
