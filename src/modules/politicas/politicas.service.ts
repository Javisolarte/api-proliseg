import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CrearPoliticaDto, RegistrarConsentimientoDto } from './dto/politicas.dto';
import * as crypto from 'crypto';

@Injectable()
export class PoliticasService {
    private readonly logger = new Logger(PoliticasService.name);

    constructor(private readonly supabaseService: SupabaseService) { }

    /**
     * Obtiene la última versión vigente de una política por su código
     */
    async obtenerPoliticaVigente(codigo: string = 'HABEAS_DATA') {
        const supabase = this.supabaseService.getClient();

        const { data, error } = await supabase
            .from('politicas')
            .select('*')
            .eq('codigo', codigo)
            .eq('vigente', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            this.logger.warn(`No se encontró política vigente para código: ${codigo}`);
            return null;
        }

        return data;
    }

    /**
     * Verifica si un usuario ya aceptó la versión vigente de una política
     */
    async verificarConsentimiento(userId: number, tipoUsuario: 'usuario' | 'empleado', codigoPolitica: string) {
        const politica = await this.obtenerPoliticaVigente(codigoPolitica);
        if (!politica) return { requiere_aceptacion: false, mensaje: 'No hay política vigente' };

        const supabase = this.supabaseService.getClient();
        let query = supabase.from('consentimientos')
            .select('*')
            .eq('politica_id', politica.id)
            .eq('aceptado', true)
            .eq('revocado', false);

        if (tipoUsuario === 'usuario') query = query.eq('usuario_id', userId);
        else query = query.eq('empleado_id', userId);

        const { data } = await query.single();

        if (data) {
            return { requiere_aceptacion: false, consentiento: data };
        } else {
            return {
                requiere_aceptacion: true,
                politica_pendiente: {
                    id: politica.id,
                    nombre: politica.nombre,
                    version: politica.version,
                    contenido: politica.contenido
                }
            };
        }
    }

    /**
     * Registra la aceptación (o rechazo) de una política
     */
    async registrarConsentimiento(userId: number, tipoUsuario: 'usuario' | 'empleado', dto: RegistrarConsentimientoDto, metadata: { ip: string, ua: string }) {
        const supabase = this.supabaseService.getClient();

        // 1. Obtener política para hash
        const { data: politica } = await supabase
            .from('politicas')
            .select('contenido')
            .eq('id', dto.politica_id)
            .single();

        if (!politica) throw new Error('Política no encontrada');

        // 2. Generar Hash de Integridad (Prueba inmutable de qué firmó y cuándo)
        const timestamp = new Date().toISOString();
        const dataString = `${politica.contenido}|${userId}|${timestamp}|${dto.aceptado}`;
        const hash = crypto.createHash('sha256').update(dataString).digest('hex');

        // 3. Guardar
        const dataToSave: any = {
            politica_id: dto.politica_id,
            aceptado: dto.aceptado,
            ip_address: metadata.ip,
            user_agent: metadata.ua,
            firmado_hash: hash,
            created_at: timestamp
        };

        if (tipoUsuario === 'usuario') dataToSave.usuario_id = userId;
        else dataToSave.empleado_id = userId;

        const { data, error } = await supabase
            .from('consentimientos')
            .insert(dataToSave)
            .select()
            .single();

        if (error) {
            this.logger.error(`Error guardando consentimiento: ${error.message}`);
            throw new Error('Error al registrar consentimiento');
        }

        this.logger.log(`Consentimiento registrado: User ${userId} (${tipoUsuario}) - Politica ${dto.politica_id}`);
        return data;
    }

    /**
     * Crear nueva versión de política (Admin)
     */
    async crearNuevaVersion(dto: CrearPoliticaDto) {
        const supabase = this.supabaseService.getClient();

        // 1. Marcar anteriores como no vigentes
        await supabase.from('politicas')
            .update({ vigente: false })
            .eq('codigo', dto.codigo);

        // 2. Insertar nueva
        const { data, error } = await supabase
            .from('politicas')
            .insert({
                codigo: dto.codigo,
                nombre: dto.nombre,
                version: dto.version,
                contenido: dto.contenido,
                vigente: true
            })
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    /**
     * 📜 Obtener todas las políticas pendientes de aceptación para un usuario
     */
    async obtenerPendientes(userId: number, tipoUsuario: 'usuario' | 'empleado') {
        const supabase = this.supabaseService.getClient();

        // 1. Obtener todas las políticas vigentes
        const { data: politicas } = await supabase
            .from('politicas')
            .select('*')
            .eq('vigente', true);

        if (!politicas?.length) return [];

        const pendientes: any[] = [];

        // 2. Verificar cuáles no están firmadas
        for (const pol of politicas) {
            const estado = await this.verificarConsentimiento(userId, tipoUsuario, pol.codigo);
            if (estado.requiere_aceptacion && estado.politica_pendiente) {
                pendientes.push(estado.politica_pendiente);
            }
        }

        return pendientes;
    }

    /**
     * 🚫 Revocar consentimiento (Derecho Habeas Data)
     */
    async revocarConsentimiento(userId: number, tipoUsuario: 'usuario' | 'empleado', politicaId: number, motivo: string) {
        const supabase = this.supabaseService.getClient();

        let query = supabase.from('consentimientos')
            .update({
                revocado: true,
                fecha_revocacion: new Date().toISOString(),
                metadatos: { motivo_revocacion: motivo } as any
            })
            .eq('politica_id', politicaId)
            .eq('revocado', false);

        if (tipoUsuario === 'usuario') query = query.eq('usuario_id', userId);
        else query = query.eq('empleado_id', userId);

        const { data, error } = await query.select().single();

        if (error) throw new Error('Error al revocar o consentimiento no encontrado');
        return data;
    }
}
