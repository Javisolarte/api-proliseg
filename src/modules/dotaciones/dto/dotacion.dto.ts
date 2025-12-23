import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum CondicionDotacion {
    NUEVO = 'nuevo',
    SEGUNDA = 'segunda',
}

export enum EstadoProgramacion {
    PENDIENTE = 'pendiente',
    ENTREGADA = 'entregada',
    VENCIDA = 'vencida',
}

// --- DOTACIONES EMPLEADO (Asignaciones) ---

export class CreateDotacionEmpleadoDto {
    @ApiProperty({ description: 'ID del empleado', example: 1 })
    @IsInt()
    @IsNotEmpty()
    empleado_id: number;

    @ApiProperty({ description: 'ID de la variante del artículo', example: 1 })
    @IsInt()
    @IsNotEmpty()
    variante_id: number;

    @ApiProperty({ description: 'Cantidad entregada', example: 1 })
    @IsInt()
    @Min(1)
    @IsNotEmpty()
    cantidad: number;

    @ApiProperty({ description: 'Fecha de entrega', example: '2023-10-27' })
    @IsDateString()
    @IsNotEmpty()
    fecha_entrega: string;

    @ApiProperty({ description: 'ID del usuario que entrega' })
    @IsInt()
    @IsNotEmpty()
    entregado_por: number; // This will likely be set from the JWT user in the service/controller

    @ApiProperty({ description: 'Observaciones', required: false })
    @IsString()
    @IsOptional()
    observaciones?: string;

    @ApiProperty({ description: 'Condición de la dotación', enum: CondicionDotacion, example: 'nuevo' })
    @IsEnum(CondicionDotacion)
    @IsNotEmpty()
    condicion: string;
}

// --- PROGRAMACION DOTACION ---

export class CreateDotacionProgramacionDto {
    @ApiProperty({ description: 'ID del empleado' })
    @IsInt()
    @IsNotEmpty()
    empleado_id: number;

    @ApiProperty({ description: 'Fecha última dotación', required: false })
    @IsDateString()
    @IsOptional()
    fecha_ultima_dotacion?: string;

    @ApiProperty({ description: 'Fecha próxima dotación', required: false })
    @IsDateString()
    @IsOptional()
    fecha_proxima_dotacion?: string;

    @ApiProperty({ description: 'Estado', enum: EstadoProgramacion, default: 'pendiente' })
    @IsEnum(EstadoProgramacion)
    @IsOptional()
    estado?: string;
}

export class UpdateDotacionProgramacionDto {
    @ApiProperty({ description: 'Fecha última dotación', required: false })
    @IsDateString()
    @IsOptional()
    fecha_ultima_dotacion?: string;

    @ApiProperty({ description: 'Fecha próxima dotación', required: false })
    @IsDateString()
    @IsOptional()
    fecha_proxima_dotacion?: string;

    @ApiProperty({ description: 'Estado', enum: EstadoProgramacion, required: false })
    @IsEnum(EstadoProgramacion)
    @IsOptional()
    estado?: string;
}
