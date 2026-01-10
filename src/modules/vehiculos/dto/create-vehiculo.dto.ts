import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsDateString, IsInt } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateVehiculoDto {
    @ApiProperty({ example: 'moto', description: 'Tipo de vehículo (moto, carro)' })
    @IsString()
    @IsNotEmpty()
    tipo: string;

    @ApiProperty({ example: 'ABC-123', description: 'Placa del vehículo' })
    @IsString()
    @IsNotEmpty()
    placa: string;

    @ApiProperty({ example: 'Yamaha', description: 'Marca del vehículo' })
    @IsString()
    @IsOptional()
    marca?: string;

    @ApiProperty({ example: 'XTZ 125', description: 'Modelo del vehículo' })
    @IsString()
    @IsOptional()
    modelo?: string;

    @ApiProperty({ example: 125, description: 'Cilindraje del vehículo' })
    @IsInt()
    @IsOptional()
    @Transform(({ value }) => value ? parseInt(value) : undefined)
    cilindraje?: number;

    @ApiProperty({ example: '123456789', description: 'Número de tarjeta de propiedad' })
    @IsString()
    @IsNotEmpty()
    tarjeta_propietario: string;

    @ApiProperty({ example: '2024-12-31', description: 'Fecha de vencimiento del SOAT' })
    @IsDateString()
    @IsNotEmpty()
    soat_vencimiento: string;

    @ApiProperty({ example: '2024-12-31', description: 'Fecha de vencimiento de la tecnomecánica' })
    @IsDateString()
    @IsNotEmpty()
    tecnomecanica_vencimiento: string;

    @ApiProperty({ example: 'https://example.com/soat.pdf', description: 'URL o path del documento SOAT', required: false })
    @IsString()
    @IsOptional()
    url_soat?: string;

    @ApiProperty({ example: 'https://example.com/tecno.pdf', description: 'URL o path del documento tecnomecánica', required: false })
    @IsString()
    @IsOptional()
    url_tecnomecanica?: string;

    @ApiProperty({ example: 'https://example.com/tarjeta.pdf', description: 'URL o path de la tarjeta de propiedad', required: false })
    @IsString()
    @IsOptional()
    url_tarjeta_propiedad?: string;

    @ApiProperty({ example: true, description: 'Si el vehículo está activo' })
    @IsBoolean()
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    activo?: boolean;
}
