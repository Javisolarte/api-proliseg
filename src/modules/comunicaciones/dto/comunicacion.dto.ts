import { IsNotEmpty, IsString, IsNumber, IsOptional, IsEnum, IsBoolean, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TipoComunicacion {
    AUDIO = 'audio',
    VIDEO = 'video',
    TEXTO = 'texto',
    EMERGENCIA = 'emergencia'
}



export enum EstadoSesion {
    ACTIVA = 'activa',
    FINALIZADA = 'finalizada',
    INTERRUMPIDA = 'interrumpida'
}

export enum OrigenAudio {
    APP = 'app',
    DASHBOARD = 'dashboard'
}

/**
 * DTO para iniciar una sesión de comunicación
 */
export class IniciarComunicacionDto {
    @ApiProperty({ description: 'ID del empleado que inicia la comunicación' })
    @IsNumber()
    @IsNotEmpty()
    empleado_id: number;

    @ApiPropertyOptional({ description: 'ID del puesto desde donde se comunica' })
    @IsNumber()
    @IsOptional()
    puesto_id?: number;

    @ApiPropertyOptional({ description: 'ID del cliente relacionado' })
    @IsNumber()
    @IsOptional()
    cliente_id?: number;

    @ApiProperty({ description: 'Tipo de comunicación', enum: TipoComunicacion })
    @IsEnum(TipoComunicacion)
    @IsNotEmpty()
    tipo: TipoComunicacion;

    @ApiPropertyOptional({ description: 'Mensaje inicial o identificación (ej: "Central reportándose")' })
    @IsString()
    @IsOptional()
    mensaje_inicial?: string;

    @ApiPropertyOptional({ description: 'Latitud de origen' })
    @IsNumber()
    @IsOptional()
    latitud?: number;

    @ApiPropertyOptional({ description: 'Longitud de origen' })
    @IsNumber()
    @IsOptional()
    longitud?: number;

    @ApiPropertyOptional({ description: 'Información del dispositivo' })
    @IsString()
    @IsOptional()
    dispositivo?: string;

    @ApiPropertyOptional({ description: 'Indica si la llamada incluye video (default: false)' })
    @IsBoolean()
    @IsOptional()
    con_video?: boolean;

    @ApiPropertyOptional({ description: 'Versión de la app' })
    @IsString()
    @IsOptional()
    version_app?: string;
}

/**
 * DTO para iniciar comunicación desde el dashboard (broadcast/grupo)
 */
export class IniciarComunicacionDashboardDto {
    @ApiProperty({ description: 'ID del puesto objetivo' })
    @IsNumber()
    @IsNotEmpty()
    puesto_id: number;

    @ApiProperty({ description: 'IDs de los empleados destinatarios' })
    @IsNumber({}, { each: true })
    @IsNotEmpty()
    empleados_ids: number[];

    @ApiProperty({ description: 'ID del usuario del dashboard' })
    @IsNumber()
    @IsNotEmpty()
    usuario_dashboard_id: number;
}

/**
 * DTO para registrar dispositivo/empleado al conectar
 */
export class RegistrarDispositivoDto {
    @ApiProperty({ description: 'ID del empleado' })
    @IsNumber()
    @IsNotEmpty()
    empleado_id: number;

    @ApiPropertyOptional({ description: 'ID del puesto' })
    @IsNumber()
    @IsOptional()
    puesto_id?: number;

    @ApiPropertyOptional({ description: 'Información del dispositivo' })
    @IsString()
    @IsOptional()
    dispositivo?: string;
}

/**
 * DTO para transmitir un chunk de audio
 */
export class AudioChunkDto {
    @ApiProperty({ description: 'ID de la sesión de comunicación' })
    @IsString()
    @IsNotEmpty()
    sesion_id: string;

    @ApiProperty({ description: 'Audio en formato base64' })
    @IsString()
    @IsNotEmpty()
    audio_data: string;

    @ApiProperty({ description: 'Número de secuencia del chunk' })
    @IsNumber()
    @IsNotEmpty()
    sequence: number;

    @ApiPropertyOptional({ description: 'Formato del audio (webm, mp3, wav, etc.)' })
    @IsString()
    @IsOptional()
    formato?: string;

    @ApiPropertyOptional({ description: 'Origen del audio (app o dashboard)', enum: OrigenAudio })
    @IsEnum(OrigenAudio)
    @IsOptional()
    origen?: OrigenAudio;

    @ApiPropertyOptional({ description: 'Duración del chunk en milisegundos' })
    @IsNumber()
    @IsOptional()
    duracion_ms?: number;

    @ApiPropertyOptional({ description: 'Indica si es el último chunk' })
    @IsBoolean()
    @IsOptional()
    es_final?: boolean;
}

/**
 * DTO para que el dashboard inicie una respuesta
 */
export class ResponderComunicacionDto {
    @ApiProperty({ description: 'ID de la sesión a la que se responde' })
    @IsString()
    @IsNotEmpty()
    sesion_id: string;

    @ApiProperty({ description: 'ID del usuario del dashboard que responde' })
    @IsNumber()
    @IsNotEmpty()
    usuario_dashboard_id: number;

    @ApiPropertyOptional({ description: 'Mensaje de respuesta inicial' })
    @IsString()
    @IsOptional()
    mensaje_respuesta?: string;
}

/**
 * DTO para finalizar una sesión de comunicación
 */
export class FinalizarComunicacionDto {
    @ApiProperty({ description: 'ID de la sesión a finalizar' })
    @IsString()
    @IsNotEmpty()
    sesion_id: string;

    @ApiPropertyOptional({ description: 'Motivo de finalización' })
    @IsString()
    @IsOptional()
    motivo?: string;

    @ApiPropertyOptional({ description: 'Duración total en segundos' })
    @IsNumber()
    @IsOptional()
    duracion_total_segundos?: number;
}

/**
 * DTO para mensaje de texto rápido
 */
export class MensajeTextoDto {
    @ApiProperty({ description: 'ID del empleado que envía el mensaje' })
    @IsNumber()
    @IsNotEmpty()
    empleado_id: number;

    @ApiProperty({ description: 'Contenido del mensaje' })
    @IsString()
    @IsNotEmpty()
    mensaje: string;

    @ApiPropertyOptional({ description: 'ID del puesto relacionado' })
    @IsNumber()
    @IsOptional()
    puesto_id?: number;

    @ApiPropertyOptional({ description: 'Prioridad del mensaje (normal, urgente, emergencia)' })
    @IsString()
    @IsOptional()
    prioridad?: string;
}

/**
 * DTO para respuesta de sesión activa
 */
export class SesionActivaResponseDto {
    @ApiProperty()
    sesion_id: string;

    @ApiProperty()
    empleado_id: number;

    @ApiProperty()
    empleado_nombre: string;

    @ApiProperty()
    tipo: TipoComunicacion;

    @ApiProperty()
    mensaje_inicial?: string;

    @ApiProperty()
    puesto_nombre?: string;

    @ApiProperty()
    cliente_nombre?: string;

    @ApiProperty()
    fecha_inicio: string;

    @ApiProperty()
    duracion_segundos: number;

    @ApiProperty()
    latitud?: number;

    @ApiProperty()
    longitud?: number;
}

// ==========================================
// 🌐 WebRTC DTOs
// ==========================================

export class WebRTCOfferDto {
    @IsString()
    @IsNotEmpty()
    sesion_id: string;

    @IsObject()
    @IsNotEmpty()
    offer: RTCSessionDescriptionInit;

    @IsNumber()
    @IsOptional()
    target_empleado_id?: number;
}

export class WebRTCAnswerDto {
    @IsString()
    @IsNotEmpty()
    sesion_id: string;

    @IsObject()
    @IsNotEmpty()
    answer: RTCSessionDescriptionInit;

    @IsNumber()
    @IsOptional()
    target_usuario_dashboard_id?: number;
}

export class WebRTCCandidateDto {
    @IsString()
    @IsNotEmpty()
    sesion_id: string;

    @IsObject()
    @IsNotEmpty()
    candidate: RTCIceCandidateInit;

    @IsNumber()
    @IsOptional()
    target_id?: number;
}

export class JoinRoomDto {
    @IsString()
    @IsNotEmpty()
    sesion_id: string;
}
