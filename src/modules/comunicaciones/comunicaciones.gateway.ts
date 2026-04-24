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
import { IniciarComunicacionDto, FinalizarComunicacionDto, MensajeTextoDto, ResponderComunicacionDto, OrigenAudio, IniciarComunicacionDashboardDto, RegistrarDispositivoDto, WebRTCOfferDto, WebRTCAnswerDto, WebRTCCandidateDto, JoinRoomDto } from './dto/comunicacion.dto';

// 🟢 Máquina de Estados (FSM)
export enum SessionState {
    INIT = 'INIT',                    // Sesión creada
    WAITING_FOR_PEER = 'WAITING',     // Esperando a que el otro par se una
    OFFER_SENT = 'OFFER_SENT',        // Oferta enviada
    ANSWER_RECEIVED = 'ANSWER_RECEIVED', // Respuesta recibida (Conectando)
    CONNECTED = 'CONNECTED',          // Conexión establecida (implícito por ICE)
    RECONNECTING = 'RECONNECTING',    // Reconexión temporal
    DISCONNECTED = 'DISCONNECTED',    // Desconectado
    CLOSED = 'CLOSED'                 // Sesión finalizada
}

export interface SesionActiva {
    sesion_id: string;
    empleado_id?: number;
    empleado_nombre?: string;
    puesto_id?: number;
    cliente_id?: number;
    tipo: string;
    mensaje_inicial?: string;
    fecha_inicio: Date;
    socket_id: string; // Socket ID del iniciador (App)
    latitud?: number;
    longitud?: number;

    // WebRTC & Estado
    state: SessionState;
    usuario_dashboard_id?: number;
    dashboard_socket_id?: string;

    // Metadata
    respondiendo?: boolean;
    origen_inicial: OrigenAudio;
    empleados_ids?: number[];
    target_sockets?: string[];
    ultima_actividad: Date;
}

@WebSocketGateway({
    cors: {
        origin: '*',
    },
    namespace: 'comunicaciones',
})
export class ComunicacionesGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server: Namespace;
    private logger: Logger = new Logger('ComunicacionesGateway');

    // Almacenamiento
    private sesionesActivas: Map<string, SesionActiva> = new Map();
    private socketToSesion: Map<string, string> = new Map();
    private empleadoToSocket: Map<number, string> = new Map();

    private cleanupInterval: NodeJS.Timeout;
    private readonly SESSION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutos (aumentado para WebRTC)

    constructor(
        // 🛡️ Inyección de Auth para validar tokens
        private readonly authService: AuthService
    ) {
        this.cleanupInterval = setInterval(() => this.checkInactiveSessions(), 60 * 1000);
    }

    /**
     * 🔐 HANDSHAKE: Validación de Token JWT
     */
    async handleConnection(client: Socket) {
        try {
            // Extraer token del handshake (auth.token o query.token)
            const token = client.handshake.auth?.token || client.handshake.query?.token;

            if (!token) {
                this.logger.warn(`⛔ Conexión rechazada: Sin token (ID: ${client.id})`);
                client.disconnect();
                return;
            }

            // Validar token
            const user = await this.authService.validateToken(token as string);

            if (!user || !user.valid) {
                this.logger.warn(`⛔ Conexión rechazada: Token inválido (ID: ${client.id})`);
                client.disconnect();
                return;
            }

            // Guardar info del usuario en el socket
            client.data.user = user;
            this.logger.log(`🔌 Cliente conectado y autenticado: ${user.email} (${client.id})`);

            // Notificar estado actual
            this.emitirSesionesActivas(client);

        } catch (error) {
            this.logger.error(`Error en handshake: ${error.message}`);
            client.disconnect();
        }
    }

    /**
     * 📱 Registrar dispositivo/empleado
     */
    @SubscribeMessage('registrar_dispositivo')
    handleRegistrarDispositivo(
        @MessageBody() data: RegistrarDispositivoDto,
        @ConnectedSocket() client: Socket,
    ) {
        // Limpiar socket anterior
        const oldSocket = this.empleadoToSocket.get(data.empleado_id);
        if (oldSocket && oldSocket !== client.id) {
            this.socketToSesion.delete(oldSocket);
        }

        this.empleadoToSocket.set(data.empleado_id, client.id);
        client.data.empleado_id = data.empleado_id; // Vincular al socket

        this.logger.log(`📱 Dispositivo registrado: Empleado ${data.empleado_id}`);
        return { success: true };
    }

    async getIceServers() {
        // Credenciales REALES de Metered.ca - Cuenta PROLISEG
        const iceServers: any[] = [
            { urls: 'stun:stun.relay.metered.ca:80' },
            { urls: 'stun:stun.l.google.com:19302' },
            {
                urls: 'turn:global.relay.metered.ca:80',
                username: '6959f5f62b3db3b3fb64b457',
                credential: 'M68t+dYXK48p3EES',
            },
            {
                urls: 'turn:global.relay.metered.ca:80?transport=tcp',
                username: '6959f5f62b3db3b3fb64b457',
                credential: 'M68t+dYXK48p3EES',
            },
            {
                urls: 'turn:global.relay.metered.ca:443',
                username: '6959f5f62b3db3b3fb64b457',
                credential: 'M68t+dYXK48p3EES',
            },
            {
                urls: 'turns:global.relay.metered.ca:443?transport=tcp',
                username: '6959f5f62b3db3b3fb64b457',
                credential: 'M68t+dYXK48p3EES',
            },
        ];
        return iceServers;
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`🔌 Cliente desconectado: ${client.id}`);

        const sesionId = this.socketToSesion.get(client.id);
        if (sesionId) {
            const sesion = this.sesionesActivas.get(sesionId);
            if (sesion) {
                // Notificar al peer que se desconectó
                client.to(sesionId).emit('peer_disconnected', {
                    sesion_id: sesionId,
                    socket_id: client.id
                });

                // Si la sesión estaba activa, marcar como interrumpida o esperar reconexión
                if (sesion.state !== SessionState.CLOSED) {
                    sesion.state = SessionState.DISCONNECTED;
                    this.logger.warn(`⚠️ Sesión ${sesionId} en estado DISCONNECTED`);
                }
            }
            this.socketToSesion.delete(client.id);
        }

        // Limpieza de empleado
        if (client.data.empleado_id) {
            this.empleadoToSocket.delete(client.data.empleado_id);
        }
    }

    /**
     * 🎙️ Iniciar Sesión (App -> Server)
     */
    @SubscribeMessage('iniciar_comunicacion')
    handleIniciarComunicacion(
        @MessageBody() data: IniciarComunicacionDto,
        @ConnectedSocket() client: Socket,
    ) {
        // 🧹 Limpieza agresiva: Si ya existe una sesión para este empleado, cerrarla
        for (const [id, s] of this.sesionesActivas.entries()) {
            if (s.empleado_id === data.empleado_id) {
                this.logger.warn(`🧹 Cerrando sesión previa de Empleado ${data.empleado_id}: ${id}`);
                this.server.to(id).emit('sesion_finalizada', { sesion_id: id, motivo: 'Nueva sesión iniciada' });
                this.sesionesActivas.delete(id);
                this.socketToSesion.delete(s.socket_id);
                if (s.dashboard_socket_id) this.socketToSesion.delete(s.dashboard_socket_id);
            }
        }

        const user = client.data.user;
        const empleadoNombre = user?.nombre_completo || user?.full_name || `Guardia-${data.empleado_id}`;
        
        // 🆔 GENERACIÓN DE NOMBRE TÁCTICO DE CANAL
        // Formato: "1042 - Juan Perez" o "Puesto-662 - Guardia"
        const puestoIdentificador = data.puesto_id ? `${data.puesto_id}` : 'MOVIL';
        const canalNombreTactico = `${puestoIdentificador} - ${empleadoNombre}`;
        const sesionId = canalNombreTactico; // El nombre es el ID ahora para máxima claridad

        // 🔄 REUTILIZAR CANAL TÁCTICO EXISTENTE
        let sesion = this.sesionesActivas.get(sesionId);
        
        if (sesion) {
            this.logger.log(`♻️ Canal táctico activo: ${sesionId}`);
            sesion.ultima_actividad = new Date();
            sesion.socket_id = client.id;
        } else {
            sesion = {
                sesion_id: sesionId,
                empleado_id: data.empleado_id,
                empleado_nombre: empleadoNombre,
                puesto_id: data.puesto_id,
                cliente_id: data.cliente_id,
                tipo: data.tipo,
                fecha_inicio: new Date(),
                socket_id: client.id,
                latitud: data.latitud,
                longitud: data.longitud,
                state: SessionState.INIT,
                origen_inicial: OrigenAudio.APP,
                ultima_actividad: new Date(),
            };
            this.sesionesActivas.set(sesionId, sesion);
        }

        this.socketToSesion.set(client.id, sesionId);
        this.socketToSesion.set(client.id, sesionId);

        // 🌐 Unirse a la sala WebRTC
        client.join(sesionId);

        this.logger.log(`🎙️ Sesión iniciada (${sesion.state}): ${sesionId}`);

        // Broadcast a Dashboards
        this.server.emit('nueva_comunicacion', { ...sesion, chunks_recibidos: 0 });

        return { success: true, sesion_id: sesionId };
    }

    /**
     * 📞 Dashboard Responde (Join Room)
     */
    @SubscribeMessage('responder_comunicacion')
    handleResponderComunicacion(
        @MessageBody() data: ResponderComunicacionDto,
        @ConnectedSocket() client: Socket,
    ) {
        const sesion = this.sesionesActivas.get(data.sesion_id);
        if (!sesion) return { success: false, error: 'Sesión no encontrada' };

        // Actualizar estado
        sesion.respondiendo = true;
        sesion.usuario_dashboard_id = data.usuario_dashboard_id;
        sesion.dashboard_socket_id = client.id;
        sesion.state = SessionState.WAITING_FOR_PEER; // Esperando negociación
        sesion.ultima_actividad = new Date();

        // 🌐 Unirse a la sala
        client.join(data.sesion_id);
        this.socketToSesion.set(client.id, data.sesion_id);

        this.logger.log(`📞 Dashboard unido a ${data.sesion_id}. Estado: ${sesion.state}`);

        // Notificar a App que dashboard está listo
        const appSocket = this.server.sockets.get(sesion.socket_id);
        if (appSocket) {
            appSocket.emit('dashboard_respondiendo', {
                sesion_id: data.sesion_id,
                usuario_dashboard_id: data.usuario_dashboard_id
            });
        }

        return { success: true };
    }

    // ==========================================
    // 🌐 WebRTC Signaling Handlers (FSM Aware)
    // ==========================================

    @SubscribeMessage('join_room')
    handleJoinRoom(@MessageBody() data: JoinRoomDto, @ConnectedSocket() client: Socket) {
        // Validación de seguridad: Verificar si el usuario tiene permiso para unirse a esta sala (TODO)
        client.join(data.sesion_id);
        return { success: true };
    }

    @SubscribeMessage('webrtc_offer')
    handleWebRTCOffer(@MessageBody() data: WebRTCOfferDto, @ConnectedSocket() client: Socket) {
        const sesion = this.sesionesActivas.get(data.sesion_id);

        if (sesion) {
            sesion.state = SessionState.OFFER_SENT;
            sesion.ultima_actividad = new Date();
            this.logger.log(`📨 WebRTC OFFER de ${client.id} para sesión ${data.sesion_id}`);
        }

        client.to(data.sesion_id).emit('webrtc_offer', {
            offer: data.offer,
            sesion_id: data.sesion_id,
            sender_socket_id: client.id
        });
        return { success: true };
    }

    @SubscribeMessage('webrtc_answer')
    handleWebRTCAnswer(@MessageBody() data: WebRTCAnswerDto, @ConnectedSocket() client: Socket) {
        const sesion = this.sesionesActivas.get(data.sesion_id);

        if (sesion) {
            sesion.state = SessionState.ANSWER_RECEIVED; // Transición a connected implícita
            sesion.ultima_actividad = new Date();
            this.logger.log(`📩 WebRTC ANSWER de ${client.id} para sesión ${data.sesion_id}`);
        }

        client.to(data.sesion_id).emit('webrtc_answer', {
            answer: data.answer,
            sesion_id: data.sesion_id,
            sender_socket_id: client.id
        });
        return { success: true };
    }

    @SubscribeMessage('webrtc_candidate')
    handleWebRTCCandidate(@MessageBody() data: WebRTCCandidateDto, @ConnectedSocket() client: Socket) {
        // Los candidatos fluyen libremente mientras la sesión esté activa
        client.to(data.sesion_id).emit('webrtc_candidate', {
            candidate: data.candidate,
            sesion_id: data.sesion_id,
            sender_socket_id: client.id
        });
        return { success: true };
    }

    @SubscribeMessage('control_remoto')
    handleControlRemoto(@MessageBody() data: { sesion_id: string, accion: string }, @ConnectedSocket() client: Socket) {
        this.logger.log(`🎮 Control remoto: ${data.accion} en sesión ${data.sesion_id}`);
        // Retransmitir a la sala de la sesión
        client.to(data.sesion_id).emit('control_remoto', data);
        return { success: true };
    }

    /**
     * 🔄 ICE Restart Signaling
     */
    @SubscribeMessage('negotiation_needed')
    handleNegotiationNeeded(@MessageBody() data: { sesion_id: string }, @ConnectedSocket() client: Socket) {
        this.logger.log(`🔄 Renegociación solicitada en ${data.sesion_id}`);
        client.to(data.sesion_id).emit('negotiation_needed', {
            sesion_id: data.sesion_id,
            sender_socket_id: client.id
        });
    }

    // ==========================================
    // 🛑 Finalización y Limpieza
    // ==========================================

    @SubscribeMessage('broadcast_ptt')
    handleBroadcastPTT(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
        this.logger.log(`📢 Difusión Masiva bloqueadora solicitada por: ${client.id}`);
        // Notificar a todos que una transmisión general ha comenzado
        // Esto activará el modal en todos los dispositivos configurados
        this.server.emit('nueva_comunicacion', {
            sesion_id: `broadcast_${Date.now()}`,
            empleado_nombre: 'DIFUSIÓN GENERAL',
            tipo: 'broadcast',
            fecha_inicio: new Date(),
            socket_id: client.id,
            state: SessionState.INIT
        });
        return { success: true };
    }

    @SubscribeMessage('finalizar_comunicacion')
    handleFinalizarComunicacion(
        @MessageBody() data: FinalizarComunicacionDto,
        @ConnectedSocket() client: Socket,
    ) {
        const sesion = this.sesionesActivas.get(data.sesion_id);
        if (!sesion) return;

        sesion.state = SessionState.CLOSED;

        this.server.to(data.sesion_id).emit('sesion_finalizada', {
            sesion_id: data.sesion_id,
            motivo: data.motivo,
            estado: 'finalizada'
        });

        // Desconectar sockets de la sala
        this.server.in(data.sesion_id).socketsLeave(data.sesion_id);

        this.sesionesActivas.delete(data.sesion_id);
        this.socketToSesion.delete(sesion.socket_id);
        if (sesion.dashboard_socket_id) this.socketToSesion.delete(sesion.dashboard_socket_id);

        return { success: true };
    }

    private emitirSesionesActivas(client: Socket) {
        const sesiones = Array.from(this.sesionesActivas.values()).map(s => ({
            sesion_id: s.sesion_id,
            empleado_id: s.empleado_id,
            tipo: s.tipo,
            mensaje_inicial: s.mensaje_inicial,
            fecha_inicio: s.fecha_inicio,
            state: s.state // Incluir estado FSM
        }));
        client.emit('sesiones_activas', sesiones);
    }

    private checkInactiveSessions() {
        const now = new Date().getTime();
        for (const [sesionId, sesion] of this.sesionesActivas.entries()) {
            if (now - sesion.ultima_actividad.getTime() > this.SESSION_TIMEOUT_MS) {
                this.logger.warn(`🧹 Timeout de sesión: ${sesionId}`);
                this.server.to(sesionId).emit('sesion_finalizada', {
                    sesion_id: sesionId,
                    motivo: 'Inactividad (Timeout)',
                });
                this.sesionesActivas.delete(sesionId);
            }
        }
    }
    /**
     * Método público para emitir eventos desde el servicio
     */
    emitEvent(event: string, data: any) {
        this.server.emit(event, data);
    }

    /**
     * Obtener estadísticas de sesiones activas y usuarios en línea
     */
    getEstadisticas() {
        return {
            sesiones_activas: this.sesionesActivas.size,
            clientes_conectados: this.server.sockets.size,
            empleados_online: this.empleadoToSocket.size,
            lista_sesiones: Array.from(this.sesionesActivas.values())
        };
    }
}
