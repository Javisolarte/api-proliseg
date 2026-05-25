import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString } from 'class-validator';

export class IniciarMiRondaDto {
    @ApiPropertyOptional({ description: 'ID de configuracion. Si no llega, se usa la ronda activa del puesto asignado.' })
    @IsOptional()
    @IsInt()
    configuracion_id?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    dispositivo_id?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    latitud?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    longitud?: number;
}

export class RegistrarCheckQrRondaDto {
    @ApiProperty()
    @IsInt()
    punto_id: number;

    @ApiProperty()
    @IsString()
    qr_payload_recibido: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    latitud?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    longitud?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    precision_metros?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    evidencia_foto_url?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    evidencia_foto_path?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    comentario?: string;
}

export class FinalizarMiRondaDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    evidencia_cierre_url?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    evidencia_cierre_path?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    motivo_incompleta?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    observaciones?: string;
}

export class TrackingMiRondaDto {
    @ApiProperty()
    @IsNumber()
    latitud: number;

    @ApiProperty()
    @IsNumber()
    longitud: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    precision_metros?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    bateria?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    velocidad?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    evento?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    dispositivo_id?: string;
}
