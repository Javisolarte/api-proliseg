export class ExportQueryDto {
    formato: 'pdf' | 'excel' | 'csv';
    desde?: Date;
    hasta?: Date;
    cliente_id?: number;
    puesto_id?: number;
    estado?: string;
}
