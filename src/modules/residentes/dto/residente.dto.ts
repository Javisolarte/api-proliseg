import { IsString, IsNotEmpty, IsNumber, IsOptional, IsBoolean, IsEmail } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateResidenteDto {
    @ApiProperty()
    @IsNumber()
    cliente_id: number;

    @ApiProperty()
    @IsNumber()
    puesto_id: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    usuario_id?: number;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    nombre_completo: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    documento: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    torre_bloque?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    apto_casa?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    telefono?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsEmail()
    correo?: string;

    @ApiProperty()
    @IsString()
    tipo_habitante: 'propietario' | 'arrendatario' | 'familiar' | 'apoderado';

    @ApiProperty({ required: false, default: true })
    @IsOptional()
    @IsBoolean()
    activo?: boolean;
}

export class UpdateResidenteDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    nombre_completo?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    telefono?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsEmail()
    correo?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    torre_bloque?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    apto_casa?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    tipo_habitante?: 'propietario' | 'arrendatario' | 'familiar' | 'apoderado';

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    activo?: boolean;
}

export class CreateResidenteVehiculoDto {
    @ApiProperty()
    @IsNumber()
    residente_id: number;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    placa: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    tipo_vehiculo?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    marca?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    color?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    parqueadero_asignado?: string;
}
