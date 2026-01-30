import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { IntegrityService } from '../../common/services/integrity.service';

@Injectable()
export class ComplianceService {
    private readonly logger = new Logger(ComplianceService.name);

    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly integrityService: IntegrityService
    ) { }

    /**
     * Registra una acción legal sensible (Ver, Descargar, Modificar)
     */
    async logLegalAction(params: {
        usuario_id: number;
        entidad: string;
        entidad_id: string;
        accion: 'VIEW' | 'DOWNLOAD' | 'MODIFY' | 'DELETE';
        detalles?: any;
        ip?: string;
        user_agent?: string;
    }) {
        try {
            const supabase = this.supabaseService.getClient();

            const logEntry = {
                ...params,
                timestamp: new Date().toISOString(),
            };

            // Generar hash de integridad para el log mismo (inmutabilidad)
            const hash = this.integrityService.generateHash(logEntry);

            const { error } = await supabase.from('audit_legal_log').insert({
                ...logEntry,
                hash_integridad: hash,
            });

            if (error) throw error;
            return { success: true };
        } catch (error) {
            this.logger.error('Error en logLegalAction:', error);
            // No lanzamos excepción para no bloquear el flujo principal, solo logueamos
            return { success: false };
        }
    }

    /**
     * Verifica la integridad de un registro crítico
     */
    async verifyRecordIntegrity(entidad: string, id: string, storedHash: string) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase.from(entidad).select('*').eq('id', id).single();

        if (error || !data) throw new BadRequestException('Registro no encontrado para verificación');

        // Remover el hash de los datos antes de verificar
        const { hash_integridad, ...recordData } = data;
        const isValid = this.integrityService.verifyIntegrity(recordData, storedHash);

        return {
            isValid,
            entidad,
            id,
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Aplica Soft Delete legal
     */
    async softDelete(entidad: string, id: string, usuario_id: number, motivo: string) {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from(entidad)
            .update({
                activo: false,
                deleted_at: new Date().toISOString(),
                deleted_by: usuario_id,
                deletion_reason: motivo
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw new BadRequestException(`Error al realizar soft delete en ${entidad}`);

        await this.logLegalAction({
            usuario_id,
            entidad,
            entidad_id: id,
            accion: 'DELETE',
            detalles: { motivo }
        });

        return data;
    }
}
