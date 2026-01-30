export class ClienteConfiguracionDto {
    horarios?: {
        entradaHorarios?: string;
        salida?: string;
        zona_horaria?: string;
    };
    reglas_visitas?: {
        requiere_autorizacion?: boolean;
        max_acompanantes?: number;
        registro_vehiculos?: boolean;
    };
    limites?: {
        max_guardias?: number;
        max_puestos?: number;
        max_contratos?: number;
    };
    branding?: {
        logo_url?: string;
        color_primario?: string;
        color_secundario?: string;
    };
}
