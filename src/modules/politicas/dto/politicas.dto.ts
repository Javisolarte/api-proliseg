export class CrearPoliticaDto {
    codigo: string;
    nombre: string;
    version: string;
    contenido: string;
}

export class RegistrarConsentimientoDto {
    politica_id: number;
    aceptado: boolean;
}

export class ConsultarEstadoLegalDto {
    usuario_id?: number;
    empleado_id?: number;
}
