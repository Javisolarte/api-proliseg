export class BloquearUsuarioDto {
    motivo: string;
    dias?: number; // Duración del bloqueo en días, null = permanente
}

export class ListarSesionesDto {
    usuario_id?: number;
    activas?: boolean;
}
