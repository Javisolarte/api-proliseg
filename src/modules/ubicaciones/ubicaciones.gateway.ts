import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    MessageBody,
    ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket, Namespace } from 'socket.io';
import { Logger } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { UbicacionesService } from './ubicaciones.service';
import { RegistrarUbicacionDto } from './dto/ubicaciones.dto';

// 🟢 Estados explícitos del tracking
export enum TrackingState {
    ACTIVE = 'ACTIVE',
    PAUSED = 'PAUSED',
    STOPPED = 'STOPPED'
}

interface TrackingSession {
    socket_id: string;
    empleado_id: number;
    state: TrackingState;

    // Estado para validación y throttling
    last_update_ts: number;   // Timestamp del último mensaje recibido (server time)
    last_client_ts: number;   // Timestamp del último punto (client time)

    // Estado para persistencia
    last_saved_at: number;    // Server time del último guardado DB
    last_saved_lat: number;
    last_saved_lng: number;

    // Configuración activa (podría venir de DB)
    config: {
        min_distance: number;
        min_interval: number;
        accuracy_threshold: number;
    };
}

@WebSocketGateway({
    cors: { origin: '*' },
    namespace: 'ubicaciones',
})
export class UbicacionesGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server: Namespace;
    private logger: Logger = new Logger('UbicacionesGateway');

    // Almacenamiento en memoria volátil (Map<EmpleadoID, Session>)
    // Usamos EmpleadoID como clave para manejar reconexiones (socket cambia, empleado no)
    private activeSessions: Map<number, TrackingSession> = new Map();
    // Mapa auxiliar SocketID -> EmpleadoID
    private socketToEmpleado: Map<string, number> = new Map();

    // Constantes de seguridad
    private readonly SPEED_LIMIT_KMH = 250; // Tolerancia alta para evitar falsos positivos en autopista
    private readonly MAX_Time_DRIFT_MS = 60 * 1000; // Rechazar puntos con +/- 60s de diferencia

    constructor(
        private readonly authService: AuthService,
        private readonly ubicacionesService: UbicacionesService
    ) { }

    async handleConnection(client: Socket) {
        try {
            const token = client.handshake.auth?.token || client.handshake.query?.token;
            if (!token) {
                client.disconnect();
                return;
            }

            const user = await this.authService.validateToken(token as string);
            if (!user || !user.valid) {
                client.disconnect();
                return;
            }

            // Mapear empleado (asumimos que el token trae info o se busca)
            // Por simplicidad, extraemos ID o usamos uno genérico si es test
            const empleado_id = user.user_id ? parseInt(user.user_id.split('-')[0], 16) : 0; // HACK provisional si ID no es numérico directo
            // En producción: const empleado = await this.service.getEmpleadoByUserId(user.user_id);

            // Rehidratar sesión si existe (Reconexión)
            let session = this.activeSessions.get(empleado_id); // Debería buscar por ID real

            client.data.user = user;

            this.logger.log(`📍 Cliente conectado: ${user.email}`);
        } catch (error) {
            client.disconnect();
        }
    }

    handleDisconnect(client: Socket) {
        const empleadoId = this.socketToEmpleado.get(client.id);
        if (empleadoId) {
            this.socketToEmpleado.delete(client.id);
            // No borramos activeSessions inmediatamente para permitir reconexión rápida
            // Podríamos poner un timeout de limpieza
        }
        this.logger.log(`📍 Cliente desconectado: ${client.id}`);
    }

    /**
     * ▶️ START TRACKING: Inicia sesión explícita
     */
    @SubscribeMessage('start_tracking')
    handleStartTracking(@ConnectedSocket() client: Socket, @MessageBody() data: { empleado_id: number }) {
        const existing = this.activeSessions.get(data.empleado_id);

        const config = {
            min_distance: 50,      // 50 metros
            min_interval: 30000,   // 30 segundos
            accuracy_threshold: 30 // 30 metros de precisión
        };

        const session: TrackingSession = existing || {
            socket_id: client.id,
            empleado_id: data.empleado_id,
            state: TrackingState.ACTIVE,
            last_update_ts: Date.now(),
            last_client_ts: 0,
            last_saved_at: 0,
            last_saved_lat: 0,
            last_saved_lng: 0,
            config
        };

        // Actualizar socket ID por si es reconexión
        session.socket_id = client.id;
        session.state = TrackingState.ACTIVE;

        this.activeSessions.set(data.empleado_id, session);
        this.socketToEmpleado.set(client.id, data.empleado_id);

        // Unir a sala personal
        client.join(`tracking_employee_${data.empleado_id}`);

        this.logger.log(`▶️ Tracking iniciado para empleado ${data.empleado_id}`);

        return { success: true, state: 'ACTIVE', config };
    }

    /**
     * ⏹️ STOP TRACKING
     */
    @SubscribeMessage('stop_tracking')
    handleStopTracking(@ConnectedSocket() client: Socket) {
        const empleadoId = this.socketToEmpleado.get(client.id);
        if (empleadoId) {
            const session = this.activeSessions.get(empleadoId);
            if (session) {
                session.state = TrackingState.STOPPED;
                this.activeSessions.delete(empleadoId); // Limpieza completa
            }
        }
        return { success: true, state: 'STOPPED' };
    }

    /**
     * 🛰️ UPDATE LOCATION: Loop principal
     */
    @SubscribeMessage('update_location')
    async handleUpdateLocation(
        @MessageBody() data: RegistrarUbicacionDto,
        @ConnectedSocket() client: Socket
    ) {
        const now = Date.now();
        const empleadoId = data.empleado_id; // Confiar en el DTO o en el socket mapping

        // 1. Recuperar sesión
        let session = this.activeSessions.get(empleadoId);

        // Auto-crear si no existe (robusticidad) pero marcar warn
        if (!session) {
            session = {
                socket_id: client.id,
                empleado_id: empleadoId,
                state: TrackingState.ACTIVE,
                last_update_ts: now,
                last_client_ts: 0,
                last_saved_at: 0,
                last_saved_lat: 0,
                last_saved_lng: 0,
                config: { min_distance: 50, min_interval: 30000, accuracy_threshold: 100 } // Default laxo
            };
            this.activeSessions.set(empleadoId, session);
            this.socketToEmpleado.set(client.id, empleadoId);
        }

        // 2. 🛡️ VALIDACIONES (Rechazo temprano)

        // A) Estado Activo
        if (session.state !== TrackingState.ACTIVE) {
            return { success: false, error: 'Tracking not active' };
        }

        // B) Coordenadas basura
        if (!data.latitud || !data.longitud || (data.latitud === 0 && data.longitud === 0)) {
            return { success: false, error: 'Invalid zero coords' };
        }

        // C) Timestamp Client vs Server (Anti-replay)
        if (Math.abs(now - data.timestamp) > this.MAX_Time_DRIFT_MS) {
            this.logger.warn(`⏳ Descarte por timestamp lejano: ${data.timestamp} vs ${now}`);
            // return { success: false, error: 'Timestamp drill' }; // Opcional: strict
        }

        // D) Duplicado exacto (Client TS repetido)
        if (data.timestamp <= session.last_client_ts) {
            return { success: true, info: 'Duplicate ignored' };
        }

        // E) Precisión (Accuracy)
        const acc = data.precision_metros || 100;
        if (acc > session.config.accuracy_threshold) {
            // this.logger.debug(`🎯 Descarte por precisión baja: ${acc}m`);
            return { success: false, error: 'Low accuracy' };
        }

        // F) Velocidad excesiva
        if (data.velocidad && data.velocidad > this.SPEED_LIMIT_KMH) {
            return { success: false, error: 'Impossible speed' };
        }

        // --- PUNTO VÁLIDO ---
        session.last_client_ts = data.timestamp;
        session.last_update_ts = now;

        const payloadVisual = {
            empleado_id: empleadoId,
            lat: data.latitud,
            lng: data.longitud,
            ts: data.timestamp,
            speed: data.velocidad,
            batt: data.bateria,
            acc: data.precision_metros,
            type: 'visual'
        };

        // 3. 📡 BROADCAST VISUAL (A todos los interesados)
        // Se envía SIEMPRE para animación fluida en el mapa
        this.server.to('tracking_dashboard').emit('location_visual', payloadVisual);
        this.server.to(`tracking_employee_${empleadoId}`).emit('location_visual', payloadVisual);

        // 4. 💾 PERSISTENCIA (Throttled / Adaptativa)

        const dist = this.calculateDistance(session.last_saved_lat, session.last_saved_lng, data.latitud, data.longitud);
        const timeDiff = now - session.last_saved_at;

        // Reglas de guardado:
        // 1. Distancia significativa (> config)
        // 2. Tiempo límite excedido (> config + buffer)
        // 3. Evento especial (Boton panico, etc - no cubierto aqui, vendría en data.evento)

        const shouldSave = (dist > session.config.min_distance) || (timeDiff > session.config.min_interval);

        if (shouldSave) {
            // Actualizar estado de persistencia
            session.last_saved_at = now;
            session.last_saved_lat = data.latitud;
            session.last_saved_lng = data.longitud;

            // Emitir evento "persisted" para que el dashboard marque "punto fijo"
            this.server.to(`tracking_employee_${empleadoId}`).emit('location_persisted', {
                ...payloadVisual,
                type: 'persisted'
            });

            // Guardar en BD (Async fire-and-forget)
            this.ubicacionesService.registrar(data).catch(err =>
                this.logger.error(`Error DB Save: ${err.message}`)
            );
        }

        return { success: true };
    }

    /**
     * 🖥️ DASHBOARD: Join Rooms
     */
    @SubscribeMessage('join_tracking')
    handleJoinTracking(@ConnectedSocket() client: Socket) {
        client.join('tracking_dashboard');
        return { success: true };
    }

    @SubscribeMessage('track_employee')
    handleTrackEmployee(@MessageBody() body: { empleado_id: number }, @ConnectedSocket() client: Socket) {
        client.join(`tracking_employee_${body.empleado_id}`);
        return { success: true };
    }

    /**
     * 👮 KILL SWITCH (Backend -> App)
     */
    @SubscribeMessage('force_stop_tracking')
    handleForceStop(@MessageBody() body: { empleado_id: number, reason: string }, @ConnectedSocket() client: Socket) {
        // Enviar orden de detención a la sala personal del empleado
        const session = this.activeSessions.get(body.empleado_id);
        if (session) {
            session.state = TrackingState.STOPPED;
            // Emitir evento al socket específico de la app
            this.server.to(session.socket_id).emit('stop_tracking_command', {
                reason: body.reason || 'Admin Command'
            });
        }
        return { success: true };
    }

    // --- UTILS ---
    private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        if (!lat1 || !lon1 || !lat2 || !lon2) return 99999; // Si no hay previo, forzar guardado

        const R = 6371e3;
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }
}
