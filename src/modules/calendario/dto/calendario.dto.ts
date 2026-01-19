import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsOptional, IsBoolean, IsDateString, IsHexColor, IsInt, IsEnum } from "class-validator";

export enum NotificacionTipo {
    CORREO = 'correo',
    PUSH = 'push',
    SISTEMA = 'sistema'
}

export class CreateEventoDto {
    @ApiProperty({ example: "Cita Médica" })
    @IsString()
    titulo: string;

    @ApiProperty({ example: "Control con especialista", required: false })
    @IsOptional()
    @IsString()
    descripcion?: string;

    @ApiProperty({ example: "2026-01-20T08:00:00Z" })
    @IsDateString()
    fecha_inicio: string;

    @ApiProperty({ example: "2026-01-20T09:00:00Z" })
    @IsDateString()
    fecha_fin: string;

    @ApiProperty({ example: false, required: false })
    @IsOptional()
    @IsBoolean()
    todo_el_dia?: boolean;

    @ApiProperty({ example: "Consultorio 101", required: false })
    @IsOptional()
    @IsString()
    ubicacion?: string;

    @ApiProperty({ example: "#3788d8", required: false })
    @IsOptional()
    @IsHexColor()
    color?: string;

    @ApiProperty({ description: "ID del dueño del calendario" })
    @IsInt()
    usuario_id: number;
}

export class UpdateEventoDto {
    @IsOptional() @IsString() titulo?: string;
    @IsOptional() @IsString() descripcion?: string;
    @IsOptional() @IsDateString() fecha_inicio?: string;
    @IsOptional() @IsDateString() fecha_fin?: string;
    @IsOptional() @IsBoolean() todo_el_dia?: boolean;
    @IsOptional() @IsString() ubicacion?: string;
    @IsOptional() @IsHexColor() color?: string;
}

export class CreateRecordatorioDto {
    @ApiProperty()
    @IsInt()
    evento_id: number;

    @ApiProperty({ example: "2026-01-20T07:00:00Z" })
    @IsDateString()
    fecha_programada: string;

    @ApiProperty({ enum: NotificacionTipo, default: NotificacionTipo.SISTEMA })
    @IsOptional()
    @IsEnum(NotificacionTipo)
    tipo_notificacion?: NotificacionTipo;
}
