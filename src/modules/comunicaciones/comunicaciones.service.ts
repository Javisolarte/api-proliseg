import { Injectable, Logger } from '@nestjs/common';
import { ComunicacionesGateway } from './comunicaciones.gateway';
import { SupabaseService } from '../supabase/supabase.service';

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
     * 📝 Registrar evento de comunicación en minutas (opcional)
     * Solo si se quiere dejar registro histórico sin el audio
     */
    async registrarEnMinuta(data: {
        empleado_id: number;
        puesto_id?: number;
        mensaje: string;
        tipo: string;
        latitud?: number;
        longitud?: number;
    }) {
        const db = this.supabase.getClient();

        try {
            await db.from('minutas').insert({
                puesto_id: data.puesto_id,
                creada_por: data.empleado_id,
                contenido: data.mensaje,
                tipo: 'comunicacion',
                titulo: `Comunicación ${data.tipo.toUpperCase()}`,
                nivel_riesgo: data.tipo === 'emergencia' ? 'crítico' : 'bajo',
                ubicacion_lat: data.latitud,
                ubicacion_lng: data.longitud,
            });

            this.logger.log(`✅ Comunicación registrada en minutas para empleado ${data.empleado_id}`);
        } catch (error) {
            this.logger.error(`Error al registrar en minutas: ${error.message}`);
        }
    }

    /**
     * 🔔 Enviar notificación de emergencia
     */
    async notificarEmergencia(data: {
        empleado_id: number;
        mensaje: string;
        puesto_id?: number;
        latitud?: number;
        longitud?: number;
    }) {
        // Emitir evento especial de emergencia
        this.gateway.emitEvent('emergencia_comunicacion', {
            empleado_id: data.empleado_id,
            mensaje: data.mensaje,
            puesto_id: data.puesto_id,
            latitud: data.latitud,
            longitud: data.longitud,
            timestamp: new Date(),
        });

        // Opcionalmente registrar en minutas
        await this.registrarEnMinuta({
            ...data,
            tipo: 'emergencia',
        });

        this.logger.warn(`🚨 EMERGENCIA: ${data.mensaje} - Empleado ${data.empleado_id}`);
    }

    /**
     * 📡 Obtener información de sesión enriquecida
     */
    async obtenerInfoSesion(sesion_id: string, empleado_id: number, puesto_id?: number) {
        const empleado = await this.validarEmpleado(empleado_id);
        let puesto: any = null;

        if (puesto_id) {
            puesto = await this.obtenerInfoPuesto(puesto_id);
        }

        return {
            sesion_id,
            empleado: {
                id: empleado.id,
                nombre: empleado.nombre_completo,
                cedula: empleado.cedula,
                telefono: empleado.telefono,
            },
            puesto: puesto ? {
                id: puesto.id,
                nombre: puesto.nombre,
                direccion: puesto.direccion,
                ciudad: puesto.ciudad,
                cliente: puesto.clientes?.nombre_empresa,
            } : null,
        };
    }
    /**
     * 🌍 Obtener servidores ICE (STUN/TURN) con credenciales dinámicas (si aplica)
     */
    async getIceServers() {
        // En producción, estas variables deben venir de configuración segura
        const turnUrl = process.env.TURN_URL;
        const turnSecret = process.env.TURN_SECRET;
        const turnUser = process.env.TURN_USER || 'proliseg_user';

        const iceServers: any[] = [
            { urls: 'stun:stun.l.google.com:19302' }, // STUN público de fallback
        ];

        if (turnUrl && turnSecret) {
            // Generar credenciales temporales (TTL) si se usa protocolo estandar TURN REST API
            // O simplemente devolver las credenciales estáticas si es lo que tenemos por ahora.
            // Para COTURN con secret estático:
            const timestamp = Math.floor(Date.now() / 1000) + 24 * 3600; // Valido por 24h
            const username = `${timestamp}:${turnUser}`;

            // Nota: Esto requiere 'crypto' de Node.js, pero podemos usar un simple user/pass si no hay auth compleja
            // auth = crypto.createHmac('sha1', turnSecret).update(username).digest('base64');

            // Simplificación: Asumimos credenciales estáticas o manejadas por env por ahora
            // Si el usuario provee secret y user, los usamos.

            iceServers.push({
                urls: turnUrl,
                username: turnUser, // O la generada
                credential: turnSecret, // O la generada
            });
        }

        return { iceServers };
    }
}
