export class EnviarEmailDto {
    destinatarios: string[];
    asunto: string;
    cuerpo: string;
    adjuntos?: { filename: string; path: string }[];
}

export class EnviarWhatsAppDto {
    numero: string;
    mensaje: string;
    tipo?: 'texto' | 'plantilla';
    plantilla_id?: string;
}

export class EnviarCotizacionDto {
    cotizacion_id: number;
    email_cliente: string;
    telefono_cliente?: string;
    enviar_email: boolean;
    enviar_whatsapp?: boolean;
}
