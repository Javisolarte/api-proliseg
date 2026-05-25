import { IsIn, IsOptional, IsString } from 'class-validator';

// DTOs para Eventos
export class CrearEventoDto {
    codigo: string;
    nombre: string;
    descripcion?: string;
    prioridad_por_defecto?: 'baja' | 'media' | 'alta' | 'critica';
    canales_obligatorios?: string[];
    agrupar_notificaciones?: boolean;
}

// DTOs para Plantillas
export class CrearPlantillaDto {
    evento_id: number;
    canal: 'email' | 'sms' | 'whatsapp' | 'push' | 'in_app' | 'webhook';
    asunto_template?: string;
    cuerpo_template: string;
    metadata_template?: Record<string, any>;
    idioma?: string;
}

// DTOs para Preferencias
export class ConfigurarPreferenciasDto {
    evento_id: number;
    canal: 'email' | 'sms' | 'whatsapp' | 'push' | 'in_app' | 'webhook';
    habilitado: boolean;
    horario_silencio_inicio?: string;
    horario_silencio_fin?: string;
}

// DTOs para Dispositivos
export class RegistrarDispositivoDto {
    @IsOptional()
    @IsString()
    token?: string;

    @IsOptional()
    @IsString()
    token_dispositivo: string;

    @IsOptional()
    @IsIn(['android', 'ios', 'web'])
    plataforma: 'android' | 'ios' | 'web';

    @IsOptional()
    @IsString()
    modelo_dispositivo?: string;

    @IsOptional()
    @IsString()
    app_version?: string;
}

// DTOs para Envío
export class EnviarNotificacionDto {
    destinatarios: Array<{
        tipo: 'usuario' | 'empleado' | 'cliente';
        id: number;
    }>;
    evento_codigo?: string;
    canal?: 'email' | 'sms' | 'whatsapp' | 'push' | 'in_app';
    titulo?: string;
    mensaje: string;
    datos_extra?: Record<string, any>;
    accion_url?: string;
    prioridad?: 'baja' | 'media' | 'alta' | 'critica';
    fecha_programada?: Date;
    variables?: Record<string, any>; // Para reemplazar en templates
}

export class MarcarLeidaDto {
    notificacion_id: number;
}

export class ListarNotificacionesDto {
    estado?: 'pendiente' | 'procesando' | 'enviado' | 'entregado' | 'leido' | 'fallido' | 'cancelado';
    canal?: string;
    limit?: number;
    offset?: number;
}
