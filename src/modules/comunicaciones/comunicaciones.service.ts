import { Injectable, Logger } from '@nestjs/common';
import { ComunicacionesGateway } from './comunicaciones.gateway';
import { SupabaseService } from '../supabase/supabase.service';
import { SubirGrabacionDto } from './dto/subir-grabacion.dto';

@Injectable()
export class ComunicacionesService {
    private readonly logger = new Logger(ComunicacionesService.name);

    constructor(
        private readonly gateway: ComunicacionesGateway,
        private readonly supabase: SupabaseService,
    ) { }

    /**
     * 📊 Obtener estadísticas de comunicaciones en tiempo real
     */
    async getEstadisticas() {
        const stats = this.gateway.getEstadisticas();

        return {
            ...stats,
            timestamp: new Date(),
        };
    }

    /**
     * 🔍 Validar que un empleado existe y obtener su información
     */
    async validarEmpleado(empleado_id: number) {
        const db = this.supabase.getClient();

        const { data, error } = await db
            .from('empleados')
            .select('id, nombre_completo, cedula, telefono')
            .eq('id', empleado_id)
            .single();

        if (error || !data) {
            throw new Error(`Empleado ${empleado_id} no encontrado`);
        }

        return data;
    }

    /**
     * 🏢 Obtener información de un puesto
     */
    async obtenerInfoPuesto(puesto_id: number) {
        const db = this.supabase.getClient();

        const { data, error } = await db
            .from('puestos_trabajo')
            .select('id, nombre, direccion, ciudad, cliente_id, clientes(nombre_empresa)')
            .eq('id', puesto_id)
            .single();

        if (error || !data) {
            this.logger.warn(`Puesto ${puesto_id} no encontrado`);
            return null;
        }

        return data;
    }

    /**
     * 🌍 Obtener servidores ICE (STUN/TURN)
     */
    async getIceServers() {
        const turnUrl = process.env.TURN_URL;
        const turnUser = process.env.TURN_USER || 'proliseg_user';
        const turnSecret = process.env.TURN_SECRET;

        const iceServers: any[] = [
            { urls: 'stun:stun.l.google.com:19302' },
        ];

        if (turnUrl && turnSecret) {
            iceServers.push({
                urls: turnUrl,
                username: turnUser,
                credential: turnSecret,
            });
        }

        return { iceServers };
    }

    /**
     * 🎙️ Subir grabación de audio y guardar metadatos
     */
    async subirGrabacion(file: any, dto: SubirGrabacionDto) {
        const db = this.supabase.getSupabaseAdminClient();
        const fileName = `${dto.sesion_id}_${Date.now()}.webm`;
        const filePath = `recordings/${fileName}`;

        // 1. Subir a Supabase Storage usando helper
        await this.supabase.uploadFile('audio-calls', filePath, file.buffer, 'audio/webm');

        // 2. Generar URL pública (asumiendo que el bucket es público)
        const supabaseUrl = process.env.SUPABASE_URL;
        const audioUrl = `${supabaseUrl}/storage/v1/object/public/audio-calls/${filePath}`;

        // 3. Guardar en la base de datos
        const { data, error: dbError } = await db
            .from('comunicaciones_historial')
            .insert({
                sesion_id: dto.sesion_id,
                empleado_id: dto.empleado_id,
                puesto_id: dto.puesto_id,
                usuario_dashboard_id: dto.usuario_dashboard_id,
                tipo: dto.tipo,
                duracion_segundos: dto.duracion_segundos,
                audio_path: filePath,
                audio_url: audioUrl,
                latitud: dto.latitud,
                longitud: dto.longitud,
                fecha_inicio: dto.fecha_inicio,
                fecha_fin: new Date().toISOString()
            })
            .select()
            .single();

        if (dbError) {
            this.logger.error(`Error al guardar en historial: ${dbError.message}`);
            throw new Error(`Error al registrar historial: ${dbError.message}`);
        }

        return data;
    }

    /**
     * 📜 Obtener historial de comunicaciones
     */
    async getHistorial(query: { limit?: number, offset?: number, empleado_id?: number }) {
        const db = this.supabase.getClient();
        let q = db
            .from('comunicaciones_historial')
            .select(`
                *,
                empleados(nombre_completo),
                puestos_trabajo(nombre)
            `)
            .order('created_at', { ascending: false });

        if (query.empleado_id) {
            q = q.eq('empleado_id', query.empleado_id);
        }

        if (query.limit) q = q.limit(query.limit);
        if (query.offset) q = q.range(query.offset || 0, (query.offset || 0) + (query.limit || 10) - 1);

        const { data, error } = await q;

        if (error) {
            this.logger.error(`Error al obtener historial: ${error.message}`);
            throw new Error('No se pudo obtener el historial');
        }

        return data;
    }

    /**
     * 🔍 Obtener detalle de una grabación
     */
    async getHistorialDetalle(id: number) {
        const db = this.supabase.getClient();
        const { data, error } = await db
            .from('comunicaciones_historial')
            .select(`
                *,
                empleados(nombre_completo, cedula, telefono),
                puestos_trabajo(nombre, direccion, ciudad)
            `)
            .eq('id', id)
            .single();

        if (error) {
            throw new Error(`Registro no encontrado: ${error.message}`);
        }

        return data;
    }

    /**
     * 🗑️ Eliminar registro y archivo
     */
    async eliminarHistorial(id: number) {
        const db = this.supabase.getSupabaseAdminClient();

        // 1. Obtener registro para saber la ruta del archivo
        const { data: registro } = await db
            .from('comunicaciones_historial')
            .select('audio_path')
            .eq('id', id)
            .single();

        // 2. Eliminar de Storage si existe
        if (registro?.audio_path) {
            await this.supabase.deleteFile('audio-calls', registro.audio_path);
        }

        // 3. Eliminar de DB
        const { error } = await db
            .from('comunicaciones_historial')
            .delete()
            .eq('id', id);

        if (error) throw new Error(`Error al eliminar: ${error.message}`);

        return { success: true };
    }

    /**
     * 🔔 Notificar emergencia
     */
    async notificarEmergencia(data: {
        empleado_id: number;
        mensaje: string;
        puesto_id?: number;
        latitud?: number;
        longitud?: number;
    }) {
        this.gateway.emitEvent('emergencia_comunicacion', {
            ...data,
            timestamp: new Date(),
        });

        this.logger.warn(`🚨 EMERGENCIA: ${data.mensaje} - Empleado ${data.empleado_id}`);
    }
}
